import { describe, expect, it } from 'vitest'
import {
  checksumCandidates,
  isAllowedAssetUrl,
  isAllowedRedirectHost,
  parseChecksumFile,
  parseDigest,
  pickAsset
} from '../src/shared/patterns'

const asset = (name: string, size = 1000) => ({ name, size, url: `https://github.com/o/r/releases/download/1.0/${name}` })

describe('escolha de asset por padrão', () => {
  const sohAssets = [
    asset('SoH-Dewey-Bravo-Mac.zip'),
    asset('SoH-Dewey-Bravo-Win64.zip'),
    asset('SoH-Dewey-Bravo.appimage'),
    asset('SoH-Dewey-Bravo-Win64.zip.sha256', 90)
  ]

  it('escolhe o asset do Windows pelo glob, sem diferenciar maiúsculas', () => {
    expect(pickAsset(sohAssets, ['*Win64*.zip'])?.name).toBe('SoH-Dewey-Bravo-Win64.zip')
    expect(pickAsset(sohAssets, ['*win64*.ZIP'])?.name).toBe('SoH-Dewey-Bravo-Win64.zip')
  })

  it('respeita a ordem dos padrões (primeiro que casar vence)', () => {
    expect(pickAsset(sohAssets, ['*.appimage', '*Linux*.zip'])?.name).toBe('SoH-Dewey-Bravo.appimage')
    const old = [asset('SoH-Blair-Bravo-Linux.zip'), asset('SoH-Blair-Bravo-Win64.zip')]
    expect(pickAsset(old, ['*.appimage', '*Linux*.zip'])?.name).toBe('SoH-Blair-Bravo-Linux.zip')
    const kart = [asset('Spaghettify-Alfredo-Alfa-Linux-Old.zip'), asset('spaghetti-linux.zip')]
    expect(pickAsset(kart, ['spaghetti-linux.zip', '*linux*.zip'])?.name).toBe('spaghetti-linux.zip')
  })

  it('ignora arquivos de checksum/assinatura', () => {
    expect(pickAsset([asset('game-win64.zip.sha256'), asset('game-win64.zip.sig')], ['*win64*'])).toBeNull()
  })

  it('retorna null quando nenhum padrão casa (o app avisa e não faz nada)', () => {
    expect(pickAsset(sohAssets, ['*Linux-ARM64*.zip'])).toBeNull()
    expect(pickAsset(sohAssets, [])).toBeNull()
    expect(pickAsset([], ['*'])).toBeNull()
  })
})

describe('checksums', () => {
  it('encontra arquivos de checksum relacionados ao asset', () => {
    const assets = [asset('a.zip'), asset('a.zip.sha256', 80), asset('SHA256SUMS.txt', 300), asset('b.zip'), asset('huge-checksums.txt', 5 * 1024 * 1024)]
    expect(checksumCandidates(assets, 'a.zip').map((a) => a.name)).toEqual(['a.zip.sha256', 'SHA256SUMS.txt'])
  })

  it('lê formatos comuns de arquivo de checksum', () => {
    const hash = 'a'.repeat(64)
    const other = 'b'.repeat(64)
    expect(parseChecksumFile(`${hash}`, 'a.zip')).toBe(hash)
    expect(parseChecksumFile(`${other}  b.zip\n${hash}  a.zip\n`, 'a.zip')).toBe(hash)
    expect(parseChecksumFile(`${hash} *./dist/A.ZIP`, 'a.zip')).toBe(hash)
    expect(parseChecksumFile(`SHA256 (a.zip) = ${hash.toUpperCase()}`, 'a.zip')).toBe(hash)
    expect(parseChecksumFile(`${other}  b.zip`, 'a.zip')).toBeNull()
  })

  it('lê o campo digest da API do GitHub', () => {
    expect(parseDigest(`sha256:${'C'.repeat(64)}`)).toBe('c'.repeat(64))
    expect(parseDigest('sha1:abc')).toBeNull()
    expect(parseDigest(null)).toBeNull()
  })
})

describe('origem permitida para downloads', () => {
  it('aceita apenas HTTPS do repositório declarado', () => {
    expect(isAllowedAssetUrl('https://github.com/HarbourMasters/Shipwright/releases/download/9.3.1/x.zip', 'HarbourMasters/Shipwright')).toBe(true)
    expect(isAllowedAssetUrl('https://github.com/harbourmasters/shipwright/releases/download/9.3.1/x.zip', 'HarbourMasters/Shipwright')).toBe(true)
    expect(isAllowedAssetUrl('http://github.com/HarbourMasters/Shipwright/releases/download/9.3.1/x.zip', 'HarbourMasters/Shipwright')).toBe(false)
    expect(isAllowedAssetUrl('https://github.com/Outro/Repo/releases/download/1/x.zip', 'HarbourMasters/Shipwright')).toBe(false)
    expect(isAllowedAssetUrl('https://github.com/HarbourMasters/ShipwrightFake/releases/download/1/x.zip', 'HarbourMasters/Shipwright')).toBe(false)
    expect(isAllowedAssetUrl('https://evil.com/HarbourMasters/Shipwright/releases/download/1/x.zip', 'HarbourMasters/Shipwright')).toBe(false)
    expect(isAllowedAssetUrl('https://user:pw@github.com/HarbourMasters/Shipwright/releases/download/1/x.zip', 'HarbourMasters/Shipwright')).toBe(false)
    expect(isAllowedAssetUrl('nada', 'a/b')).toBe(false)
  })

  it('aceita redirecionamentos só para a CDN de releases do GitHub', () => {
    expect(isAllowedRedirectHost('https://release-assets.githubusercontent.com/x')).toBe(true)
    expect(isAllowedRedirectHost('https://objects.githubusercontent.com/x')).toBe(true)
    expect(isAllowedRedirectHost('http://objects.githubusercontent.com/x')).toBe(false)
    expect(isAllowedRedirectHost('https://example.com/x')).toBe(false)
  })
})
