import { createHash } from 'node:crypto'
import { promises as fs } from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { extractPackage } from '../src/main/archive'
import { listBackups, runUpdateFlow, type UpdateFlowDeps } from '../src/main/updateCore'
import type { GithubUpdates } from '../src/shared/manifest'
import type { ReleaseInfo, UpdateStage } from '../src/shared/types'
import { makeZip, readTree, tempDir, writeTree } from './helpers/fs'

const updates: GithubUpdates = {
  source: 'github-releases',
  repo: 'HarbourMasters/Shipwright',
  assetPatterns: { win32: '*Win64*.zip', linux: '*Win64*.zip' },
  includePrereleases: false,
  preserve: ['oot.o2r', 'Save/**']
}

async function setup(opts: { digest?: 'ok' | 'bad' } = {}) {
  const game = await tempDir('game-')
  await writeTree(game, { 'soh.exe': 'v1', 'oot.o2r': 'ROM', 'Save/file1.sav': 'SAVE' })
  const work = await tempDir('pkg-')
  const zipFile = path.join(work, 'SoH-Test-Win64.zip')
  await makeZip(zipFile, { 'SoH/soh.exe': 'v2', 'SoH/soh.o2r': 'data v2', 'SoH/oot.o2r': 'nao', 'SoH/Save/file1.sav': 'nao' })
  const bytes = await fs.readFile(zipFile)
  const sha = createHash('sha256').update(bytes).digest('hex')
  const url = 'https://github.com/HarbourMasters/Shipwright/releases/download/9.3.1/SoH-Test-Win64.zip'
  const release: ReleaseInfo = {
    tag: '9.3.1',
    name: '9.3.1',
    body: '',
    publishedAt: '2026-10-01T00:00:00Z',
    prerelease: false,
    htmlUrl: '',
    assets: [
      {
        name: 'SoH-Test-Win64.zip',
        size: bytes.length,
        url,
        digest: opts.digest === 'bad' ? `sha256:${'0'.repeat(64)}` : opts.digest === 'ok' ? `sha256:${sha}` : null
      }
    ]
  }
  const requested: string[] = []
  const fetchImpl = (async (input: string | URL | Request) => {
    requested.push(String(input))
    const res = new Response(bytes, { status: 200, headers: { 'content-length': String(bytes.length) } })
    Object.defineProperty(res, 'url', { value: 'https://release-assets.githubusercontent.com/x' })
    return res
  }) as typeof fetch
  const stages: UpdateStage[] = []
  const deps: UpdateFlowDeps = {
    fetchImpl,
    tmpRoot: await tempDir('tmp-'),
    backupsDir: path.join(await tempDir('bk-'), 'soh'),
    isGameRunning: async () => false,
    onStage: (s) => {
      if (stages[stages.length - 1] !== s) stages.push(s)
    },
    signal: new AbortController().signal
  }
  const params = {
    entryId: 'e1',
    manifestId: 'soh',
    updates,
    gameDir: game,
    installedVersion: '9.3.0',
    release,
    platform: 'win32' as const
  }
  return { game, deps, params, stages, requested }
}

describe('fluxo completo de atualização', () => {
  it('baixa, valida checksum, faz backup e aplica preservando dados', async () => {
    const { game, deps, params, stages, requested } = await setup({ digest: 'ok' })
    const result = await runUpdateFlow(params, deps)
    expect(result.version).toBe('9.3.1')
    expect(await readTree(game)).toEqual({ 'soh.exe': 'v2', 'soh.o2r': 'data v2', 'oot.o2r': 'ROM', 'Save/file1.sav': 'SAVE' })
    expect(stages).toEqual(['checking', 'downloading', 'verifying', 'extracting', 'backup', 'applying', 'done'])
    expect(requested).toEqual([params.release.assets[0].url])
    const backups = await listBackups(deps.backupsDir, 'e1')
    expect(backups).toHaveLength(1)
    expect(backups[0].meta).toMatchObject({ version: '9.3.0', updatedTo: '9.3.1', addedFiles: ['soh.o2r'] })
    // pasta temporária removida
    expect(await fs.readdir(deps.tmpRoot)).toEqual([])
  })

  it('checksum divergente aborta antes de tocar no jogo', async () => {
    const { game, deps, params } = await setup({ digest: 'bad' })
    await expect(runUpdateFlow(params, deps)).rejects.toMatchObject({ code: 'CHECKSUM_MISMATCH' })
    expect((await readTree(game))['soh.exe']).toBe('v1')
    expect(await listBackups(deps.backupsDir, 'e1')).toEqual([])
  })

  it('tamanho divergente é rejeitado', async () => {
    const { deps, params } = await setup()
    params.release.assets[0].size += 1
    await expect(runUpdateFlow(params, deps)).rejects.toMatchObject({ code: 'SIZE_MISMATCH' })
  })

  it('não atualiza com o jogo aberto', async () => {
    const { deps, params, requested } = await setup()
    deps.isGameRunning = async () => true
    await expect(runUpdateFlow(params, deps)).rejects.toMatchObject({ code: 'GAME_RUNNING' })
    expect(requested).toEqual([])
  })

  it('sem asset para a plataforma: avisa e não faz nada', async () => {
    const { deps, params, requested } = await setup()
    params.release.assets[0].name = 'SoH-Test-Mac.zip'
    await expect(runUpdateFlow(params, deps)).rejects.toMatchObject({ code: 'NO_MATCHING_ASSET' })
    expect(requested).toEqual([])
  })

  it('recusa assets fora do repositório declarado', async () => {
    const { deps, params, requested } = await setup()
    params.release.assets[0].url = 'https://github.com/outro/repo/releases/download/1/SoH-Test-Win64.zip'
    await expect(runUpdateFlow(params, deps)).rejects.toMatchObject({ code: 'UNTRUSTED_URL' })
    expect(requested).toEqual([])
  })

  it('falha durante a cópia restaura a versão anterior automaticamente', async () => {
    const { game, deps, params, stages } = await setup()
    const before = await readTree(game)
    deps.beforeWrite = (rel) => {
      if (rel === 'soh.o2r') throw Object.assign(new Error('arquivo em uso'), { code: 'EBUSY' })
    }
    await expect(runUpdateFlow(params, deps)).rejects.toMatchObject({ code: 'UPDATE_FAILED_RESTORED', params: { cause: 'EBUSY' } })
    expect(await readTree(game)).toEqual(before)
    expect(stages).toContain('restoring')
    expect(await listBackups(deps.backupsDir, 'e1')).toEqual([])
  })

  it('cancelamento durante o download não deixa lixo', async () => {
    const { game, deps, params } = await setup()
    const controller = new AbortController()
    controller.abort()
    deps.signal = controller.signal
    await expect(runUpdateFlow(params, deps)).rejects.toMatchObject({ code: 'CANCELLED' })
    expect((await readTree(game))['soh.exe']).toBe('v1')
    expect(await fs.readdir(deps.tmpRoot)).toEqual([])
  })

  it.skipIf(process.platform === 'win32')('não escreve através de link simbólico que aponta para fora da pasta do jogo', async () => {
    const { game, deps, params } = await setup()
    const outside = await tempDir('outside-')
    await writeTree(outside, { 'soh.o2r': 'fora' })
    await fs.symlink(path.join(outside, 'soh.o2r'), path.join(game, 'soh.o2r'))
    const before = await readTree(game)
    await expect(runUpdateFlow(params, deps)).rejects.toMatchObject({ code: 'UPDATE_FAILED_RESTORED' })
    expect(await readTree(outside)).toEqual({ 'soh.o2r': 'fora' })
    expect(await readTree(game)).toEqual(before)
  })
})

describe('extração do pacote', () => {
  it('binário solto usa só o nome do arquivo, mesmo com ".." no nome pedido', async () => {
    const work = await tempDir('raw-')
    const file = path.join(work, 'Game.AppImage')
    await fs.writeFile(file, 'bin')
    const dest = path.join(work, 'extracted')
    const root = await extractPackage(file, dest, { rawTargetName: '../../evil/game.appimage' })
    expect(root).toBe(dest)
    expect(await fs.readdir(dest)).toEqual(['game.appimage'])
    expect(await fs.readdir(work)).toEqual(['Game.AppImage', 'extracted'])
  })
})
