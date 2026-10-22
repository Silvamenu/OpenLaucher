import { promises as fs } from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { extractPackage } from '../src/main/archive'
import {
  applyUpdate,
  createBackup,
  emptyJournal,
  listBackups,
  pruneBackups,
  restoreFromJournal,
  rollbackFromBackup
} from '../src/main/updateCore'
import { createPreserveMatcher, shouldSkipFile } from '../src/shared/patterns'
import { exists, makeZip, readTree, tempDir, writeTree } from './helpers/fs'

const SOH_PRESERVE = ['oot.o2r', 'oot-mq.o2r', 'Save/**', 'shipofharkinian.json', 'mods/', 'imgui.ini']

describe('regra de preserve', () => {
  const isPreserved = createPreserveMatcher(SOH_PRESERVE)

  it('padrão sem "/" casa pelo nome em qualquer pasta', () => {
    expect(isPreserved('oot.o2r')).toBe(true)
    expect(isPreserved('OOT.O2R')).toBe(true)
    expect(isPreserved('sub/imgui.ini')).toBe(true)
    expect(isPreserved('soh.o2r')).toBe(false)
  })

  it('padrão com "/" é relativo à raiz', () => {
    expect(isPreserved('Save/file1.sav')).toBe(true)
    expect(isPreserved('Save/sub/dir/global.sav')).toBe(true)
    expect(isPreserved('save/file1.sav')).toBe(true)
    expect(isPreserved('Save')).toBe(true)
    expect(isPreserved('other/Save/file1.sav')).toBe(false)
    expect(isPreserved('mods/custom.otr')).toBe(true)
    expect(isPreserved('modsx/custom.otr')).toBe(false)
  })

  it('aceita separadores do Windows', () => {
    expect(isPreserved('Save\\file1.sav')).toBe(true)
  })

  it('só pula arquivos preservados que já existem', () => {
    expect(shouldSkipFile('oot.o2r', true, isPreserved)).toBe(true)
    expect(shouldSkipFile('oot.o2r', false, isPreserved)).toBe(false)
    expect(shouldSkipFile('soh.exe', true, isPreserved)).toBe(false)
  })

  it('lista vazia não preserva nada', () => {
    expect(createPreserveMatcher([])('qualquer.txt')).toBe(false)
  })
})

/** Pasta de jogo "instalada" na versão 1.0. */
async function installedGame(): Promise<string> {
  const dir = await tempDir('game-')
  await writeTree(dir, {
    'soh.exe': 'exe v1',
    'soh.o2r': 'port data v1',
    'oot.o2r': 'ASSETS GERADOS DA ROM',
    'shipofharkinian.json': '{"meu":"config"}',
    'Save/file1.sav': 'MEU SAVE',
    'mods/meu-mod.otr': 'MOD',
    'assets/old.yml': 'old',
    'readme.txt': 'readme v1'
  })
  return dir
}

/** Release 2.0 como zip com pasta raiz única. */
async function fakeRelease(dir: string): Promise<string> {
  const zip = path.join(dir, 'SoH-Test-Win64.zip')
  await makeZip(zip, {
    'SoH-Test-Win64/soh.exe': 'exe v2',
    'SoH-Test-Win64/soh.o2r': 'port data v2',
    'SoH-Test-Win64/oot.o2r': 'NÃO DEVERIA SOBRESCREVER',
    'SoH-Test-Win64/shipofharkinian.json': '{"padrao":true}',
    'SoH-Test-Win64/Save/file1.sav': 'SAVE VAZIO',
    'SoH-Test-Win64/assets/new.yml': 'new',
    'SoH-Test-Win64/imgui.ini': '[Window][Debug]\nPos=60,60\n',
    'SoH-Test-Win64/readme.txt': 'readme v2'
  })
  return zip
}

describe('aplicação da atualização a partir de um zip falso', () => {
  it('extrai zip com pasta raiz única e copia por cima respeitando preserve', async () => {
    const game = await installedGame()
    const work = await tempDir('work-')
    const source = await extractPackage(await fakeRelease(work), path.join(work, 'x'))
    expect(path.basename(source)).toBe('SoH-Test-Win64')

    const journal = await applyUpdate({ sourceDir: source, gameDir: game, preserve: SOH_PRESERVE }, emptyJournal())
    const tree = await readTree(game)

    // Arquivos do port atualizados
    expect(tree['soh.exe']).toBe('exe v2')
    expect(tree['soh.o2r']).toBe('port data v2')
    expect(tree['assets/new.yml']).toBe('new')
    // Dados do usuário intactos
    expect(tree['oot.o2r']).toBe('ASSETS GERADOS DA ROM')
    expect(tree['shipofharkinian.json']).toBe('{"meu":"config"}')
    expect(tree['Save/file1.sav']).toBe('MEU SAVE')
    expect(tree['mods/meu-mod.otr']).toBe('MOD')
    // Preservado que não existia é criado
    expect(tree['imgui.ini']).toContain('[Window]')
    // Arquivos antigos que não estão no pacote não são apagados
    expect(tree['assets/old.yml']).toBe('old')

    expect(journal.skipped.sort()).toEqual(['Save/file1.sav', 'oot.o2r', 'shipofharkinian.json'])
    expect(journal.added.sort()).toEqual(['assets/new.yml', 'imgui.ini'])
    expect(journal.modified.sort()).toEqual(['readme.txt', 'soh.exe', 'soh.o2r'])
  })

  it('rollback remove pastas criadas pela atualização que ficaram vazias', async () => {
    const game = await tempDir('game-')
    await writeTree(game, { 'game.exe': 'v1' })
    const work = await tempDir('work-')
    const backup = await createBackup({ gameDir: game, backupsDir: path.join(work, 'b'), entryId: 'e1', manifestId: 'x', version: '1' })
    const source = await tempDir('src-')
    await writeTree(source, { 'game.exe': 'v2', 'assets/fonts/a.ttf': 'a', 'assets/b.txt': 'b' })
    const journal = await applyUpdate({ sourceDir: source, gameDir: game, preserve: [] }, emptyJournal())
    backup.meta.addedFiles = journal.added
    await rollbackFromBackup(game, backup, [])
    expect(await readTree(game)).toEqual({ 'game.exe': 'v1' })
    expect(await exists(path.join(game, 'assets'))).toBe(false)
  })

  it('falha no meio da cópia é desfeita a partir do backup', async () => {
    const game = await installedGame()
    const before = await readTree(game)
    const work = await tempDir('work-')
    const source = await extractPackage(await fakeRelease(work), path.join(work, 'x'))
    const backup = await createBackup({ gameDir: game, backupsDir: path.join(work, 'backups'), entryId: 'e1', manifestId: 'soh', version: '1.0.0' })

    const journal = emptyJournal()
    let writes = 0
    await expect(
      applyUpdate(
        {
          sourceDir: source,
          gameDir: game,
          preserve: SOH_PRESERVE,
          beforeWrite: () => {
            if (++writes === 4) throw new Error('disco cheio (simulado)')
          }
        },
        journal
      )
    ).rejects.toThrow('simulado')
    expect(await readTree(game)).not.toEqual(before)

    await restoreFromJournal(game, backup.zip, journal)
    expect(await readTree(game)).toEqual(before)
  })
})

describe('backups e rollback', () => {
  it('mantém só os 2 backups mais recentes por jogo', async () => {
    const game = await installedGame()
    const backupsDir = path.join(await tempDir('bk-'), 'soh')
    for (const v of ['1.0.0', '1.1.0', '1.2.0']) {
      await createBackup({ gameDir: game, backupsDir, entryId: 'e1', manifestId: 'soh', version: v })
      await new Promise((r) => setTimeout(r, 5))
    }
    await createBackup({ gameDir: game, backupsDir, entryId: 'outro', manifestId: 'soh', version: '1.0.0' })
    await pruneBackups(backupsDir, 'e1')
    expect((await listBackups(backupsDir, 'e1')).map((b) => b.meta.version)).toEqual(['1.2.0', '1.1.0'])
    expect((await listBackups(backupsDir, 'outro')).length).toBe(1)
  })

  it('volta para a versão anterior sem apagar saves e removendo arquivos novos', async () => {
    const game = await installedGame()
    const work = await tempDir('work-')
    const source = await extractPackage(await fakeRelease(work), path.join(work, 'x'))
    const backup = await createBackup({ gameDir: game, backupsDir: path.join(work, 'backups'), entryId: 'e1', manifestId: 'soh', version: '1.0.0' })
    const journal = await applyUpdate({ sourceDir: source, gameDir: game, preserve: SOH_PRESERVE }, emptyJournal())
    backup.meta.addedFiles = journal.added

    // Usuário joga na versão nova: o save muda.
    await fs.writeFile(path.join(game, 'Save/file1.sav'), 'SAVE NOVO')

    await rollbackFromBackup(game, backup, SOH_PRESERVE)
    const tree = await readTree(game)
    expect(tree['soh.exe']).toBe('exe v1')
    expect(tree['soh.o2r']).toBe('port data v1')
    expect(tree['readme.txt']).toBe('readme v1')
    expect(tree['Save/file1.sav']).toBe('SAVE NOVO')
    expect(await exists(path.join(game, 'assets/new.yml'))).toBe(false)
    // a pasta "assets" já existia (assets/old.yml) e continua; pastas que ficaram vazias somem
    expect(await exists(path.join(game, 'assets/old.yml'))).toBe(true)
    // imgui.ini foi criado pela atualização mas é preservado (pode ter dados do usuário)
    expect(await exists(path.join(game, 'imgui.ini'))).toBe(true)
  })
})

describe('formatos de pacote', () => {
  it('renomeia um AppImage solto para o nome do executável', async () => {
    const work = await tempDir('work-')
    const file = path.join(work, 'SoH-Dewey-Bravo.appimage')
    await fs.writeFile(file, 'ELF')
    const root = await extractPackage(file, path.join(work, 'x'), { rawTargetName: 'soh.appimage' })
    expect(await readTree(root)).toEqual({ 'soh.appimage': 'ELF' })
  })

  it('extrai um .tar.gz dentro de um zip (formato do Zelda64Recomp para Linux)', async () => {
    const work = await tempDir('work-')
    const inner = await tempDir('inner-')
    await writeTree(inner, { 'Zelda64Recompiled/Zelda64Recompiled': 'bin', 'Zelda64Recompiled/assets/a.txt': 'a' })
    const tarFile = path.join(work, 'Zelda64Recompiled.tar.gz')
    const tar = await import('tar')
    await tar.c({ gzip: true, file: tarFile, cwd: inner }, ['Zelda64Recompiled'])
    const zip = path.join(work, 'Zelda64Recompiled-v1.2.2-Linux-X64.zip')
    await makeZip(zip, { 'Zelda64Recompiled.tar.gz': await fs.readFile(tarFile) })
    const root = await extractPackage(zip, path.join(work, 'x'))
    expect(await readTree(root)).toEqual({ Zelda64Recompiled: 'bin', 'assets/a.txt': 'a' })
  })

  it('recusa entradas de zip que escapam da pasta de destino', async () => {
    const work = await tempDir('work-')
    const zip = path.join(work, 'evil.zip')
    await makeZip(zip, { 'ok.txt': 'ok' })
    // Reescreve o nome da entrada para "../x.txt" mantendo o tamanho do cabeçalho.
    const buf = await fs.readFile(zip)
    const patched = Buffer.from(buf.toString('latin1').replace(/ok\.txt/g, '../.txt'), 'latin1')
    await fs.writeFile(zip, patched)
    await expect(extractPackage(zip, path.join(work, 'x'))).rejects.toThrow()
    expect(await exists(path.join(work, '.txt'))).toBe(false)
  })

  it('recusa formatos desconhecidos', async () => {
    const work = await tempDir('work-')
    const file = path.join(work, 'pacote.rar')
    await fs.writeFile(file, 'x')
    await expect(extractPackage(file, path.join(work, 'x'))).rejects.toMatchObject({ code: 'UNSUPPORTED_ARCHIVE' })
  })
})
