import { promises as fs } from 'node:fs'
import path from 'node:path'
import { describe, expect, it, vi } from 'vitest'
import type { AppContext } from '../src/main/context'
import { LibraryService } from '../src/main/library'
import type { GameEntry } from '../src/shared/types'
import { tempDir } from './helpers/fs'

// O serviço só usa o `app` do Electron para extrair ícones, o que não acontece aqui.
vi.mock('electron', () => ({ app: {} }))

const PNG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 1, 2, 3])
const JPEG = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 4, 5, 6])

async function setup() {
  const root = await tempDir()
  let entries: GameEntry[] = [
    {
      id: 'g1',
      manifestId: 'soh',
      path: path.join(root, 'jogo'),
      addedAt: '2026-01-01T00:00:00.000Z',
      totalPlayTimeSec: 0,
      launchCount: 0,
      installedVersion: null,
      autoUpdate: false,
      userFiles: {},
      firstRunDone: {}
    }
  ]
  const ctx = {
    platform: 'linux',
    paths: { covers: path.join(root, 'covers'), backups: path.join(root, 'backups'), configBackups: path.join(root, 'config-backups') },
    store: {
      getEntry: (id: string) => entries.find((e) => e.id === id),
      getEntries: () => entries,
      saveEntry: (entry: GameEntry) => void (entries = entries.map((e) => (e.id === entry.id ? entry : e))),
      removeEntry: (id: string) => void (entries = entries.filter((e) => e.id !== id)),
      getUpdateState: () => ({})
    },
    getManifest: () => undefined,
    emit: () => undefined
  }
  const library = new LibraryService(ctx as unknown as AppContext)
  const file = async (name: string, content: Buffer) => {
    const target = path.join(root, name)
    await fs.writeFile(target, content)
    return target
  }
  return { library, covers: ctx.paths.covers, file, entry: () => entries[0], setEntry: (e: GameEntry) => void (entries = [e]) }
}

describe('capa e banner do jogo', () => {
  it('guarda capa e banner separados e serve cada um pelo seu nome', async () => {
    const { library, covers, file, entry } = await setup()
    await library.setArt('g1', 'cover', await file('capa.png', PNG))
    await library.setArt('g1', 'banner', await file('banner.jpeg', JPEG))
    expect(entry()).toMatchObject({ coverVersion: 1, bannerVersion: 1 })
    expect((await fs.readdir(covers)).sort()).toEqual(['g1-banner.jpg', 'g1.png'])
    expect(await library.artFile('g1', 'cover')).toBe(path.join(covers, 'g1.png'))
    expect(await library.artFile('g1', 'banner')).toBe(path.join(covers, 'g1-banner.jpg'))
  })

  it('trocar a imagem apaga a anterior de outro formato e muda a versão', async () => {
    const { library, covers, file, entry } = await setup()
    await library.setArt('g1', 'banner', await file('a.png', PNG))
    await library.setArt('g1', 'banner', await file('b.jpg', JPEG))
    expect(entry().bannerVersion).toBe(2)
    expect(await fs.readdir(covers)).toEqual(['g1-banner.jpg'])
  })

  it('recusa o que não é imagem, mesmo com extensão de imagem, sem mexer na atual', async () => {
    const { library, covers, file, entry } = await setup()
    await library.setArt('g1', 'cover', await file('ok.png', PNG))
    await expect(library.setArt('g1', 'cover', await file('falsa.png', Buffer.from('<svg/>')))).rejects.toMatchObject({ code: 'INVALID_IMAGE' })
    expect(entry().coverVersion).toBe(1)
    expect(await fs.readdir(covers)).toEqual(['g1.png'])
  })

  it('remover volta ao padrão só daquela imagem; remover o jogo apaga as duas', async () => {
    const { library, covers, file, entry } = await setup()
    await library.setArt('g1', 'cover', await file('c.png', PNG))
    await library.setArt('g1', 'banner', await file('b.png', PNG))
    await library.clearArt('g1', 'banner')
    expect(entry().bannerVersion).toBeUndefined()
    expect(entry().coverVersion).toBe(1)
    expect(await fs.readdir(covers)).toEqual(['g1.png'])
    await library.remove('g1')
    expect(await fs.readdir(covers)).toEqual([])
  })

  it('não perde o que mudou na entrada enquanto a imagem era copiada', async () => {
    const { library, file, entry, setEntry } = await setup()
    const source = await file('c.png', PNG)
    const pending = library.setArt('g1', 'cover', source)
    setEntry({ ...entry(), totalPlayTimeSec: 120 })
    await pending
    expect(entry()).toMatchObject({ coverVersion: 1, totalPlayTimeSec: 120 })
  })
})
