import { promises as fs } from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { readSmallTextFile } from '../src/main/fsutil'
import { tempDir } from './helpers/fs'

describe('leitura de arquivo pequeno', () => {
  it('lê o arquivo inteiro até o limite e recusa o que passa dele', async () => {
    const dir = await tempDir()
    const file = path.join(dir, 'perfil.relaunch')
    await fs.writeFile(file, 'olá')
    expect(await readSmallTextFile(file, 4)).toBe('olá')
    expect(await readSmallTextFile(file, 3)).toBeNull()
    await fs.writeFile(file, '')
    expect(await readSmallTextFile(file, 4)).toBe('')
  })
})
