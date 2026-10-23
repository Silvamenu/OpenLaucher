import { promises as fs } from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { imageExtension, readSmallFile, readSmallTextFile } from '../src/main/fsutil'
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

describe('imagens escolhidas pelo usuário', () => {
  it('reconhece PNG, JPEG, GIF e WebP pelo conteúdo, e nada além disso', () => {
    expect(imageExtension(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0]))).toBe('.png')
    expect(imageExtension(Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10]))).toBe('.jpg')
    expect(imageExtension(Buffer.from('GIF89a\x01\x00'))).toBe('.gif')
    expect(imageExtension(Buffer.concat([Buffer.from('RIFF'), Buffer.alloc(4), Buffer.from('WEBPVP8 ')]))).toBe('.webp')
    for (const fake of ['<svg xmlns="http://www.w3.org/2000/svg"/>', '<html><script>', 'PNG', '']) {
      expect(imageExtension(Buffer.from(fake))).toBeNull()
    }
  })

  it('lê arquivo binário inteiro até o limite', async () => {
    const dir = await tempDir()
    const file = path.join(dir, 'capa.png')
    const bytes = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0xff, 0x00])
    await fs.writeFile(file, bytes)
    expect(await readSmallFile(file, 6)).toEqual(bytes)
    expect(await readSmallFile(file, 5)).toBeNull()
  })
})
