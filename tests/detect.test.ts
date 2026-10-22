import { createHash } from 'node:crypto'
import path from 'node:path'
import { beforeAll, describe, expect, it } from 'vitest'
import { detectGame } from '../src/main/detect'
import { loadManifests } from '../src/main/manifests'
import { evaluateRequirements, setHashCache } from '../src/main/requirements'
import type { Manifest } from '../src/shared/manifest'
import type { GameEntry } from '../src/shared/types'
import { tempDir, writeTree } from './helpers/fs'

let manifests: Manifest[]
beforeAll(async () => {
  manifests = (await loadManifests([{ dir: path.join(__dirname, '..', 'manifests'), origin: 'builtin' }])).manifests
})

describe('detecção de jogos', () => {
  it('identifica o projeto pelos detectFiles', async () => {
    const cases: [Record<string, string>, string][] = [
      [{ 'soh.exe': '', 'soh.o2r': '' }, 'soh'],
      [{ 'soh.appimage': '' }, 'soh'],
      [{ '2ship.exe': '', '2ship.o2r': '' }, '2ship'],
      [{ 'Zelda64Recompiled.exe': '', 'recompcontrollerdb.txt': '' }, 'zelda64recomp'],
      [{ 'Starship.exe': '', 'starship.o2r': '' }, 'starship'],
      [{ 'Spaghettify.exe': '', 'spaghetti.o2r': '' }, 'spaghettikart'],
      [{ 'sm64.us.f3dex2e.exe': '' }, 'sm64-port']
    ]
    for (const [tree, expected] of cases) {
      const dir = await tempDir()
      await writeTree(dir, tree)
      const result = await detectGame(dir, manifests)
      expect(result[0]?.manifestId, JSON.stringify(tree)).toBe(expected)
      expect(result[0].path).toBe(dir)
    }
  })

  it('não diferencia maiúsculas de minúsculas', async () => {
    const dir = await tempDir()
    await writeTree(dir, { 'SOH.EXE': '', 'Soh.O2R': '' })
    expect((await detectGame(dir, manifests))[0]?.manifestId).toBe('soh')
  })

  it('procura nas subpastas quando o usuário escolhe a pasta pai', async () => {
    const dir = await tempDir()
    await writeTree(dir, { 'Jogos/SoH/soh.exe': '', 'Jogos/SoH/soh.o2r': '', 'Starship/Starship.exe': '' })
    const result = await detectGame(dir, manifests)
    expect(result.map((r) => r.manifestId)).toEqual(['starship'])
    expect(result[0].path).toBe(path.join(dir, 'Starship'))
  })

  it('ordena por pontuação quando mais de um manifesto casa', async () => {
    const dir = await tempDir()
    await writeTree(dir, { 'soh.exe': '', 'soh.o2r': '', 'soh.otr': '', '2ship.exe': '' })
    const result = await detectGame(dir, manifests)
    expect(result.map((r) => r.manifestId)).toEqual(['soh', '2ship'])
    expect(result[0].score).toBeGreaterThan(result[1].score)
  })

  it('retorna vazio para pastas sem jogo ou inexistentes', async () => {
    const dir = await tempDir()
    await writeTree(dir, { 'outra-coisa.exe': '' })
    expect(await detectGame(dir, manifests)).toEqual([])
    expect(await detectGame(path.join(dir, 'nao-existe'), manifests)).toEqual([])
  })
})

function entryFor(dir: string, patch: Partial<GameEntry> = {}): GameEntry {
  return {
    id: 'e1',
    manifestId: 'soh',
    path: dir,
    addedAt: new Date().toISOString(),
    totalPlayTimeSec: 0,
    launchCount: 0,
    installedVersion: null,
    autoUpdate: false,
    userFiles: {},
    firstRunDone: {},
    ...patch
  }
}

describe('checklist de requisitos', () => {
  it('pasta inexistente vira "missingFolder"', async () => {
    const soh = manifests.find((m) => m.id === 'soh')!
    const report = await evaluateRequirements(soh, entryFor('/caminho/que/nao/existe'), 'win32')
    expect(report.status).toBe('missingFolder')
    expect(report.folderExists).toBe(false)
  })

  it('falta configurar até o jogo ser aberto e gerar os assets', async () => {
    const soh = manifests.find((m) => m.id === 'soh')!
    const dir = await tempDir()
    await writeTree(dir, { 'soh.exe': '', 'soh.o2r': '' })
    const first = await evaluateRequirements(soh, entryFor(dir), 'win32')
    expect(first.status).toBe('needsSetup')
    expect(first.executable).toBe('soh.exe')
    const byId = Object.fromEntries(first.items.map((i) => [i.id, i]))
    expect(byId['__executable'].ok).toBe(true)
    expect(byId['port-data'].ok).toBe(true)
    expect(byId['rom'].optional).toBe(true)
    expect(byId['rom-assets'].ok).toBe(false)

    await writeTree(dir, { 'oot.o2r': '' })
    const second = await evaluateRequirements(soh, entryFor(dir), 'win32')
    expect(second.status).toBe('ready')
  })

  it('executável ausente impede o status "Pronto"', async () => {
    const soh = manifests.find((m) => m.id === 'soh')!
    const dir = await tempDir()
    await writeTree(dir, { 'soh.o2r': '', 'oot.o2r': '' })
    const report = await evaluateRequirements(soh, entryFor(dir), 'win32')
    expect(report.status).toBe('needsSetup')
    expect(report.items[0]).toMatchObject({ type: 'executable', ok: false, detail: 'notFound' })
  })

  it('valida o arquivo do usuário por tamanho e SHA-1', async () => {
    const dir = await tempDir()
    const content = Buffer.from('rom de teste')
    const sha1 = createHash('sha1').update(content).digest('hex')
    await writeTree(dir, { 'game.exe': '', 'rom.z64': content, 'outra.z64': 'xx' })
    const manifest: Manifest = {
      ...manifests[0],
      executables: { win32: ['game.exe'], linux: ['game.exe'] },
      requirements: [
        {
          id: 'rom',
          type: 'userFile',
          label: 'ROM',
          optional: false,
          extensions: ['z64'],
          copyToGameDir: true,
          validation: { sizes: [content.length], sha1: [{ sha1: sha1.toUpperCase(), label: 'US 1.0' }] }
        }
      ]
    }
    const missing = await evaluateRequirements(manifest, entryFor(dir), 'win32')
    expect(missing.items[1].detail).toBe('notSelected')

    const ok = await evaluateRequirements(manifest, entryFor(dir, { userFiles: { rom: path.join(dir, 'rom.z64') } }), 'win32')
    expect(ok.items[1]).toMatchObject({ ok: true, matchedLabel: 'US 1.0' })
    expect(ok.status).toBe('ready')

    const wrongSize = await evaluateRequirements(manifest, entryFor(dir, { userFiles: { rom: path.join(dir, 'outra.z64') } }), 'win32')
    expect(wrongSize.items[1].detail).toBe('sizeMismatch')

    const gone = await evaluateRequirements(manifest, entryFor(dir, { userFiles: { rom: path.join(dir, 'sumiu.z64') } }), 'win32')
    expect(gone.items[1].detail).toBe('missingFile')
  })

  it('usa o SHA-1 guardado no cache em vez de reler o arquivo', async () => {
    const dir = await tempDir()
    await writeTree(dir, { 'game.exe': '', 'rom.z64': 'rom de teste' })
    const expected = 'a'.repeat(40)
    const manifest: Manifest = {
      ...manifests[0],
      executables: { win32: ['game.exe'] },
      requirements: [{ id: 'rom', type: 'userFile', label: 'ROM', optional: false, extensions: [], copyToGameDir: false, validation: { sha1: [expected] } }]
    }
    const entry = entryFor(dir, { userFiles: { rom: path.join(dir, 'rom.z64') } })
    const cache = new Map<string, string>()
    setHashCache(cache)
    try {
      expect((await evaluateRequirements(manifest, entry, 'win32')).items[1].detail).toBe('hashMismatch')
      expect([...cache.values()]).toEqual([createHash('sha1').update('rom de teste').digest('hex')])
      // Com o hash já guardado (mesmo caminho, tamanho e data), o arquivo não é lido de novo.
      for (const key of cache.keys()) cache.set(key, expected)
      expect((await evaluateRequirements(manifest, entry, 'win32')).items[1].ok).toBe(true)
    } finally {
      setHashCache(new Map())
    }
  })

  it('firstRun sem doneWhen é cumprido após o primeiro lançamento ou marcação manual', async () => {
    const dir = await tempDir()
    await writeTree(dir, { 'game.exe': '' })
    const manifest: Manifest = {
      ...manifests[0],
      executables: { win32: ['game.exe'] },
      requirements: [{ id: 'abrir', type: 'firstRun', label: 'Abrir uma vez', optional: false }]
    }
    expect((await evaluateRequirements(manifest, entryFor(dir), 'win32')).status).toBe('needsSetup')
    expect((await evaluateRequirements(manifest, entryFor(dir, { launchCount: 1 }), 'win32')).status).toBe('ready')
    expect((await evaluateRequirements(manifest, entryFor(dir, { firstRunDone: { abrir: true } }), 'win32')).status).toBe('ready')
  })
})
