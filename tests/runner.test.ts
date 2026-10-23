import { promises as fs } from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { directPlan, runnerPlan } from '../src/main/launcher'
import { loadManifests } from '../src/main/manifests'
import { evaluateRequirements } from '../src/main/requirements'
import { parseManifest, type Manifest } from '../src/shared/manifest'
import type { GameEntry } from '../src/shared/types'
import { tempDir, writeTree } from './helpers/fs'

const emulator = {
  id: 'emu',
  name: 'Emulador',
  category: 'emulators',
  repoUrl: 'https://github.com/dono/emu',
  executables: { win32: ['emu.exe'], linux: ['emu.AppImage'] },
  detectFiles: ['emu.exe'],
  launchEnv: { linux: { EMU_HOME: '{gameDir}/home' } },
  updates: { source: 'github-releases', repo: 'dono/emu', assetPatterns: { win32: '*-win.zip' } }
}

const game = {
  id: 'jogo-aaa',
  name: 'Jogo AAA',
  category: 'playstation',
  compatibility: 'playable',
  repoUrl: 'https://github.com/dono/emu',
  runner: { manifest: 'emu', args: ['--no-gui', '{gameFile}', '--dir={gameDir}'] },
  requirements: [{ id: 'game', type: 'userFile', label: 'Seu dump do jogo', extensions: ['bin'] }]
}

function parsed(data: unknown): Manifest {
  const result = parseManifest(data)
  if (!result.ok) throw new Error(result.error)
  return result.manifest
}

function entry(id: string, dir: string, extra: Partial<GameEntry> = {}): GameEntry {
  return {
    id,
    manifestId: id,
    path: dir,
    addedAt: '2026-01-01T00:00:00.000Z',
    totalPlayTimeSec: 0,
    launchCount: 0,
    installedVersion: null,
    autoUpdate: false,
    userFiles: {},
    firstRunDone: {},
    ...extra
  }
}

describe('jogos via emulador', () => {
  it('valida o formato: arquivo do jogo obrigatório, sem atualização própria, emulador diferente dele mesmo', () => {
    expect(parseManifest(game).ok).toBe(true)
    expect(parsed(game).executables).toEqual({})
    const errors = [
      { ...game, requirements: [] },
      { ...game, updates: { source: 'github-releases', repo: 'dono/emu', assetPatterns: { win32: '*' } } },
      { ...game, runner: { manifest: 'jogo-aaa' } },
      { ...game, compatibility: 'perfeito' },
      { ...game, category: 'switch' },
      // O arquivo do jogo não pode ser opcional, e o que só vale para executáveis próprios é recusado.
      { ...game, requirements: [{ ...game.requirements[0], optional: true }] },
      { ...game, requirements: [{ id: 'game', type: 'file', label: 'x', patterns: ['x'] }] },
      { ...game, launchArgs: ['--no-gui'] },
      { ...game, launchArgs: { win32: ['--no-gui'] } },
      { ...game, executables: { win32: ['jogo.exe'] } },
      { ...game, detectFiles: ['EBOOT.BIN'] },
      { ...game, launchEnv: { linux: { A: 'b' } } }
    ].map((data) => parseManifest(data))
    expect(errors.filter((r) => r.ok)).toEqual([])
    // Sem lista, o manifesto do usuário vai para "Adicionados por você"; argumentos padrão abrem o arquivo.
    expect(parsed({ ...game, category: undefined, runner: { manifest: 'emu' } })).toMatchObject({ category: 'custom', runner: { args: ['{gameFile}'] } })
  })

  it('jogo cujo emulador não existe sai do catálogo com erro', async () => {
    const dir = await tempDir()
    await writeTree(dir, {
      'jogo-aaa.json': JSON.stringify(game),
      'orfao.json': JSON.stringify({ ...game, id: 'orfao', runner: { manifest: 'sumiu' } }),
      'emu.json': JSON.stringify(emulator)
    })
    const report = await loadManifests([{ dir, origin: 'builtin' }])
    expect(report.manifests.map((m) => m.id).sort()).toEqual(['emu', 'jogo-aaa'])
    expect(report.errors).toEqual([expect.objectContaining({ file: 'orfao', message: expect.stringContaining('sumiu') })])
  })

  it('o emulador abre o arquivo do jogo, rodando na pasta dele', () => {
    const gameEntry = entry('jogo-aaa', '/jogos/aaa')
    const emuEntry = entry('emu', '/apps/emu')
    const plan = runnerPlan(
      { manifest: parsed(game), entry: gameEntry, gameFile: '/jogos/aaa/USRDIR/EBOOT.BIN' },
      { manifest: parsed(emulator), entry: emuEntry, exe: '/apps/emu/emu.AppImage' },
      'linux'
    )
    expect(plan).toEqual({
      exe: '/apps/emu/emu.AppImage',
      args: ['--no-gui', '/jogos/aaa/USRDIR/EBOOT.BIN', '--dir=/jogos/aaa'],
      cwd: '/apps/emu',
      env: { EMU_HOME: '/apps/emu/home' }
    })
    expect(directPlan(parsed(emulator), emuEntry, 'emu.AppImage', 'linux')).toMatchObject({
      exe: path.join('/apps/emu', 'emu.AppImage'),
      cwd: '/apps/emu',
      args: []
    })
  })

  it('com o nome da versão no executável, abre o mais recente (a atualização não apaga o antigo)', async () => {
    const dir = await tempDir()
    await writeTree(dir, { 'fs2_open_26_0_1_x64.exe': 'novo', 'fs2_open_25_0_0_x64.exe': 'antigo' })
    // O antigo vem antes em ordem alfabética e tem a data mais velha.
    await fs.utimes(path.join(dir, 'fs2_open_25_0_0_x64.exe'), new Date('2025-01-01'), new Date('2025-01-01'))
    const manifest = parsed({ ...emulator, id: 'fs2', executables: { win32: ['fs2_open_*_x64.exe'] }, detectFiles: ['fs2_open_*_x64.exe'] })
    const report = await evaluateRequirements(manifest, entry('fs2', dir), 'win32')
    expect(report.executable).toBe('fs2_open_26_0_1_x64.exe')
  })

  it('o checklist mostra o emulador no lugar do executável e só fica pronto com o emulador e o arquivo', async () => {
    const dir = await tempDir()
    const file = path.join(dir, 'EBOOT.BIN')
    await fs.writeFile(file, 'x')
    const manifest = parsed(game)
    const missing = await evaluateRequirements(manifest, entry('jogo-aaa', dir, { userFiles: { game: file } }), 'linux', {
      manifestId: 'emu',
      name: 'Emulador',
      entryId: null,
      executable: null
    })
    expect(missing.items[0]).toMatchObject({ type: 'runner', label: 'Emulador', ok: false, detail: 'runnerMissing', runnerId: 'emu' })
    expect(missing.status).toBe('needsSetup')

    const ready = await evaluateRequirements(manifest, entry('jogo-aaa', dir, { userFiles: { game: file } }), 'linux', {
      manifestId: 'emu',
      name: 'Emulador',
      entryId: 'e1',
      executable: '/apps/emu/emu.AppImage'
    })
    expect(ready).toMatchObject({ status: 'ready', executable: '/apps/emu/emu.AppImage' })
    const noFile = await evaluateRequirements(manifest, entry('jogo-aaa', dir), 'linux', {
      manifestId: 'emu',
      name: 'Emulador',
      entryId: 'e1',
      executable: '/x'
    })
    expect(noFile.status).toBe('needsSetup')
  })
})
