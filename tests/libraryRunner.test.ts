import { promises as fs } from 'node:fs'
import path from 'node:path'
import { describe, expect, it, vi } from 'vitest'
import type { AppContext } from '../src/main/context'
import { GameUpdateService } from '../src/main/gameUpdates'
import { GameLauncher } from '../src/main/launcher'
import { LibraryService } from '../src/main/library'
import { loadManifests } from '../src/main/manifests'
import { buildCustomManifest, customManifestId } from '../src/main/repoInstall'
import type { Manifest } from '../src/shared/manifest'
import type { GameEntry, ManifestsReport, ReleaseInfo } from '../src/shared/types'
import { tempDir, writeTree } from './helpers/fs'

// Ícones, notificações e rede do Electron não são usados nestes testes.
vi.mock('electron', () => ({ app: {}, net: {}, Notification: class {} }))

const emulator = {
  id: 'emu',
  name: 'Emulador',
  category: 'emulators',
  repoUrl: 'https://github.com/dono/emu',
  executables: { linux: ['emu.AppImage'] },
  detectFiles: ['emu.AppImage'],
  updates: { source: 'github-releases', repo: 'dono/emu', assetPatterns: { linux: 'emu-*.zip' } }
}
const game = {
  id: 'jogo',
  name: 'Jogo AAA',
  category: 'playstation',
  repoUrl: 'https://github.com/dono/emu',
  runner: { manifest: 'emu' },
  requirements: [{ id: 'game', type: 'userFile', label: 'Seu dump', extensions: ['bin'] }]
}
const port = {
  id: 'port',
  name: 'Port',
  category: 'nintendo',
  repoUrl: 'https://github.com/dono/port',
  executables: { linux: ['port.bin'] },
  detectFiles: ['port.bin'],
  updates: { source: 'github-releases', repo: 'dono/port', assetPatterns: { linux: 'port-*.zip' } }
}

function entry(id: string, manifestId: string, dir: string, extra: Partial<GameEntry> = {}): GameEntry {
  return {
    id,
    manifestId,
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

async function setup(initial: (root: string) => GameEntry[], userManifests: Record<string, string> = {}) {
  const root = await tempDir()
  const builtin = path.join(root, 'builtin')
  const user = path.join(root, 'user-manifests')
  await writeTree(builtin, { 'emu.json': JSON.stringify(emulator), 'jogo.json': JSON.stringify(game), 'port.json': JSON.stringify(port) })
  await fs.mkdir(user, { recursive: true })
  await writeTree(user, userManifests)
  let entries = initial(root)
  const events: string[] = []
  const ctx = {
    platform: 'linux',
    paths: { userManifests: user, covers: path.join(root, 'covers'), backups: path.join(root, 'backups'), configBackups: path.join(root, 'cb') },
    manifestsReport: { manifests: [], errors: [] } as ManifestsReport,
    async reloadManifests() {
      this.manifestsReport = await loadManifests([
        { dir: builtin, origin: 'builtin' },
        { dir: user, origin: 'user' }
      ])
      return this.manifestsReport
    },
    getManifest(id: string): Manifest | null {
      return this.manifestsReport.manifests.find((m) => m.id === id) ?? null
    },
    store: {
      getEntry: (id: string) => entries.find((e) => e.id === id),
      getEntries: () => entries,
      saveEntry: (next: GameEntry) =>
        void (entries = entries.some((e) => e.id === next.id) ? entries.map((e) => (e.id === next.id ? next : e)) : [...entries, next]),
      removeEntry: (id: string) => void (entries = entries.filter((e) => e.id !== id)),
      getUpdateState: () => ({}),
      setUpdateState: () => undefined,
      httpCache: () => ({ get: () => undefined, set: () => undefined }),
      getGithubToken: () => null,
      setRateLimit: () => undefined
    },
    emit: (name: string) => void events.push(name)
  }
  await ctx.reloadManifests()
  const library = new LibraryService(ctx as unknown as AppContext)
  return { root, user, ctx, library, events, entries: () => entries }
}

describe('jogos via emulador na biblioteca', () => {
  it('emulador instalando aparece como "instalando" e, ao terminar, o jogo fica pronto sem esperar outra mudança', async () => {
    const { root, library } = await setup((r) => [
      entry('e1', 'emu', path.join(r, 'emu')),
      entry('g1', 'jogo', path.join(r, 'dump'), { userFiles: { game: path.join(r, 'dump', 'EBOOT.BIN') } })
    ])
    await writeTree(root, { 'dump/EBOOT.BIN': 'meu dump' })
    await fs.mkdir(path.join(root, 'emu'))
    library.setBusy('e1', true)
    // Durante a instalação a pasta do emulador está vazia: a avaliação dele guarda "sem executável".
    await library.list()
    const busy = await library.requirements('g1')
    expect(busy.items[0]).toMatchObject({ type: 'runner', ok: false, detail: 'runnerBusy', runnerEntryId: 'e1' })

    await writeTree(root, { 'emu/emu.AppImage': '#!/bin/sh\n' })
    library.setBusy('e1', false)
    const items = await library.list()
    expect(items.find((i) => i.entry.id === 'g1')?.status).toBe('ready')
  })

  it('emulador na biblioteca sem a pasta: oferece abrir o emulador, não instalar outro', async () => {
    const { root, library } = await setup((r) => [
      entry('e1', 'emu', path.join(r, 'sumiu')),
      entry('g1', 'jogo', path.join(r, 'dump'), { userFiles: { game: path.join(r, 'dump', 'EBOOT.BIN') } })
    ])
    await writeTree(root, { 'dump/EBOOT.BIN': 'x' })
    expect((await library.requirements('g1')).items[0]).toMatchObject({ ok: false, detail: 'runnerBroken', runnerEntryId: 'e1' })
  })

  it('a pasta de um jogo via emulador não impede adicionar um port nela, e ela não muda por "trocar pasta"', async () => {
    const { root, library } = await setup((r) => [entry('g1', 'jogo', path.join(r, 'pasta'), { userFiles: { game: path.join(r, 'pasta', 'jogo.bin') } })])
    await writeTree(root, { 'pasta/jogo.bin': 'x', 'outra/.keep': '' })
    const added = await library.add(path.join(root, 'pasta'), 'port')
    expect(added.entry).toMatchObject({ manifestId: 'port' })
    await expect(library.changeFolder('g1', path.join(root, 'outra'))).rejects.toMatchObject({ code: 'NOT_FOUND' })
  })
})

describe('manifestos gerados pelo link do repositório', () => {
  const generated = buildCustomManifest({ repo: 'dono/meujogo', platform: 'linux', assetName: 'meujogo-1.0-linux.zip', tag: 'v1.0' })

  it('só o gerado pelo app pode ser tirado da lista; o escrito à mão nunca é apagado', async () => {
    const handWritten = { ...port, id: 'meu-port', category: undefined }
    const { user, library, ctx } = await setup(() => [], {
      'meu-port.json': JSON.stringify(handWritten),
      [`${generated.id}.json`]: JSON.stringify(generated)
    })
    expect(ctx.getManifest('meu-port')).toMatchObject({ category: 'custom', generated: false })
    expect(ctx.getManifest(generated.id)).toMatchObject({ generated: true })
    await expect(library.removeCustomManifest('meu-port')).rejects.toMatchObject({ code: 'NOT_FOUND' })
    await expect(library.setCustomExecutable('meu-port', 'x.bin')).rejects.toMatchObject({ code: 'NOT_FOUND' })
    expect(JSON.parse(await fs.readFile(path.join(user, 'meu-port.json'), 'utf8'))).toEqual(JSON.parse(JSON.stringify(handWritten)))
    await library.removeCustomManifest(generated.id)
    expect(ctx.getManifest(generated.id)).toBeNull()
  })

  it('substituto de um embutido sem "category" continua na lista do original', async () => {
    const { ctx } = await setup(() => [], { 'port.json': JSON.stringify({ ...port, category: undefined, name: 'Meu Port' }) })
    expect(ctx.getManifest('port')).toMatchObject({ name: 'Meu Port', origin: 'user', category: 'nintendo', generated: false })
  })

  async function service(userManifests: Record<string, string>) {
    const env = await setup(() => [], userManifests)
    const updates = new GameUpdateService(env.ctx as unknown as AppContext, env.library)
    const release: ReleaseInfo = {
      tag: 'v2.0',
      name: 'v2.0',
      body: '',
      publishedAt: '2026-10-01T00:00:00Z',
      prerelease: false,
      htmlUrl: 'https://github.com/dono/meujogo/releases/tag/v2.0',
      assets: [{ name: 'meujogo-2.0-linux.zip', size: 10, url: 'https://github.com/dono/meujogo/releases/download/v2.0/meujogo-2.0-linux.zip' }]
    }
    ;(updates as unknown as { client: unknown }).client = { getLatestRelease: async () => release }
    return { ...env, updates }
  }

  it('nunca reaproveita um manifesto com o mesmo id que é de outro repositório', async () => {
    const id = customManifestId('dono/meujogo')
    const impostor = { ...generated, id, updates: { ...generated.updates, repo: 'outro/repo' } }
    const { updates, user } = await service({ [`${id}.json`]: JSON.stringify(impostor) })
    const parent = await tempDir()
    await expect(updates.installFromRepo('https://github.com/dono/meujogo', 'meujogo-2.0-linux.zip', parent)).rejects.toMatchObject({
      code: 'INVALID_REPO_URL'
    })
    expect(JSON.parse(await fs.readFile(path.join(user, `${id}.json`), 'utf8')).updates.repo).toBe('outro/repo')
  })

  it('se a instalação nem começa (pasta ocupada), o manifesto volta a ser o que era', async () => {
    const id = customManifestId('dono/meujogo')
    const parent = await tempDir()
    await writeTree(parent, { 'meujogo/ocupado.txt': 'x' })

    // Projeto novo: o manifesto gerado não fica para trás.
    const fresh = await service({})
    await expect(fresh.updates.installFromRepo('github.com/dono/meujogo', 'meujogo-2.0-linux.zip', parent)).rejects.toMatchObject({ code: 'FOLDER_NOT_EMPTY' })
    await expect(fs.access(path.join(fresh.user, `${id}.json`))).rejects.toThrow()
    expect(fresh.ctx.getManifest(id)).toBeNull()

    // Projeto já adicionado: o arquivo continua igual, inclusive o executável escolhido.
    const known = { ...generated, executables: { linux: ['bin/meujogo'] }, detectFiles: ['bin/meujogo'] }
    const before = `${JSON.stringify(known, null, 2)}\n`
    const again = await service({ [`${id}.json`]: before })
    await expect(again.updates.installFromRepo('github.com/dono/meujogo', 'meujogo-2.0-linux.zip', parent)).rejects.toMatchObject({ code: 'FOLDER_NOT_EMPTY' })
    expect(await fs.readFile(path.join(again.user, `${id}.json`), 'utf8')).toBe(before)
  })
})

describe('sessões em andamento', () => {
  it('o emulador continua "rodando" enquanto algum jogo dele estiver aberto', async () => {
    const exits: string[] = []
    let done: () => void = () => undefined
    const finished = new Promise<void>((resolve) => (done = resolve))
    const launcher = new GameLauncher(process.platform === 'win32' ? 'win32' : 'linux', {
      onStart: () => undefined,
      onExit: (id) => {
        exits.push(id)
        if (exits.length === 2) done()
      }
    })
    const plan = (ms: number) => ({ exe: process.execPath, args: ['-e', `setTimeout(() => {}, ${ms})`], cwd: process.cwd(), env: {} })
    await launcher.launch('g1', plan(50), ['emu'])
    await launcher.launch('g2', plan(1500), ['emu'])
    await expect(launcher.launch('emu', plan(10))).rejects.toMatchObject({ code: 'ALREADY_RUNNING' })
    await vi.waitFor(() => expect(exits).toEqual(['g1']), { timeout: 5000 })
    expect(launcher.isRunning('emu')).toBe(true)
    await finished
    expect(launcher.isRunning('emu')).toBe(false)
  })
})
