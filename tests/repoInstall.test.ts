import { describe, expect, it } from 'vitest'
import {
  assetPatternFrom,
  buildCustomManifest,
  customManifestId,
  isGeneratedManifest,
  parseRepoUrl,
  rankAssets,
  rankExecutables,
  suggestAsset
} from '../src/main/repoInstall'
import { parseManifest } from '../src/shared/manifest'
import { pickAsset } from '../src/shared/patterns'

const asset = (name: string) => ({ name, size: 1 })

describe('instalar pelo link do repositório', () => {
  it('aceita só links de repositórios do GitHub', () => {
    expect(parseRepoUrl('https://github.com/hedge-dev/UnleashedRecomp')).toBe('hedge-dev/UnleashedRecomp')
    expect(parseRepoUrl('github.com/dono/projeto.git')).toBe('dono/projeto')
    expect(parseRepoUrl('  https://www.github.com/dono/projeto/releases/latest  ')).toBe('dono/projeto')
    expect(parseRepoUrl('http://github.com/dono/projeto')).toBe('dono/projeto')
    for (const bad of [
      '',
      'dono/projeto',
      'https://gitlab.com/dono/projeto',
      'https://github.com/dono',
      'https://evil.com/github.com/a/b',
      'https://user:pw@github.com/a/b',
      'https://github.com:8443/a/b',
      'file:///github.com/a/b',
      'https://github.com/../b',
      'https://github.com/a/b%20c'
    ]) {
      expect(parseRepoUrl(bad)).toBeNull()
    }
  })

  it('ordena os arquivos do release pela plataforma e deixa o usuário escolher no empate', () => {
    const assets = [
      'Game-1.2-linux-x86_64.AppImage',
      'Game-1.2-win64.zip',
      'Game-1.2-macos.dmg',
      'Game-1.2-win64-debug-symbols.zip',
      'Game-1.2.msi',
      'checksums.sha256',
      'Game-1.2-android.apk',
      'Game-1.2-win-arm64.zip'
    ].map(asset)
    const win = rankAssets(assets, 'win32')
    expect(win.map((r) => r.asset.name)).toEqual(['Game-1.2-win64.zip'])
    expect(suggestAsset(win)?.name).toBe('Game-1.2-win64.zip')
    expect(rankAssets(assets, 'linux').map((r) => r.asset.name)).toEqual(['Game-1.2-linux-x86_64.AppImage'])
    // Sem pista de sistema: os dois servem e nenhum é sugerido.
    const neutral = rankAssets([asset('game-a.zip'), asset('game-b.zip')], 'win32')
    expect(neutral).toHaveLength(2)
    expect(suggestAsset(neutral)).toBeNull()
  })

  it('instalador solto nunca vira "o jogo" (seria aberto a cada Jogar)', () => {
    const assets = ['Game-1.0-win64-Setup.exe', 'GameSetup-1.0.exe', 'Game-Installer.exe', 'Game-1.0-win64.zip'].map(asset)
    expect(rankAssets(assets, 'win32').map((r) => r.asset.name)).toEqual(['Game-1.0-win64.zip'])
    expect(suggestAsset(rankAssets([asset('GameSetup-1.0.exe')], 'win32'))).toBeNull()
  })

  it('o padrão gerado acha o mesmo arquivo nas próximas versões', () => {
    const pattern = assetPatternFrom('Game-v1.2.3-win64.zip', 'v1.2.3')
    expect(pattern).toBe('Game-*-win64.zip')
    expect(pickAsset([asset('Game-v1.3.0-win64.zip'), asset('Game-v1.3.0-linux.zip')], [pattern])?.name).toBe('Game-v1.3.0-win64.zip')
    expect(assetPatternFrom('[beta] Jogo (win).zip', 'nightly')).toBe('\\[beta\\] Jogo \\(win\\).zip')
    expect(pickAsset([asset('[beta] Jogo (win).zip')], [assetPatternFrom('[beta] Jogo (win).zip', 'nightly')])).not.toBeNull()
    // Versões sem pontos, datas e números curtos também viram "*"; arquitetura ("win64", "x86_64") fica.
    expect(assetPatternFrom('Game_1_2_3_win64.zip', 'v1.2.3')).toBe('Game_*_win64.zip')
    expect(assetPatternFrom('Game-2024-05-01-win64.zip', 'nightly-2024-05-01')).toBe('Game-*-win64.zip')
    expect(assetPatternFrom('Game-4-win64.zip', '4')).toBe('Game-*-win64.zip')
    expect(assetPatternFrom('Jogo-v2.0-linux-x86_64.zip', 'v2.0')).toBe('Jogo-*-linux-x86_64.zip')
  })

  it('o padrão nunca pega outro arquivo do mesmo release (outro sistema, build de debug)', () => {
    for (const [chosen, tag, sibling, next] of [
      ['Game-v1.0.zip', 'v1.0', 'Game-v1.0-linux.zip', 'Game-v1.1.zip'],
      ['MyPort-v2.1.0-windows-x64.zip', 'v2.1.0', 'MyPort-v2.1.0-debug-windows-x64.zip', 'MyPort-v2.2.0-windows-x64.zip']
    ]) {
      for (const order of [
        [sibling, chosen],
        [chosen, sibling]
      ]) {
        const pattern = assetPatternFrom(chosen, tag, order)
        expect(pickAsset(order.map(asset), [pattern])?.name).toBe(chosen)
        // E continua achando a versão seguinte, sem pegar o vizinho dela.
        const nextSibling = sibling.replace(tag.slice(1), next.match(/\d+\.\d+(\.\d+)?/)![0])
        expect(pickAsset([asset(nextSibling), asset(next)], [pattern])?.name).toBe(next)
      }
    }
  })

  it('gera um manifesto válido, com id seguro e sem reconhecer pastas de outros jogos', () => {
    expect(customManifestId('Dono.Legal/Meu_Projeto--X')).toMatch(/^gh-dono-legal-meu_projeto-x-[0-9a-f]{8}$/)
    const id = customManifestId('dono/Jogo')
    const archive = buildCustomManifest({ repo: 'dono/Jogo', platform: 'win32', assetName: 'Jogo-1.0-win64.zip', tag: 'v1.0' })
    const parsed = parseManifest(archive)
    expect(parsed.ok).toBe(true)
    if (!parsed.ok) return
    expect(parsed.manifest).toMatchObject({ id, category: 'custom', detectFiles: [`.relaunch-${id}`] })
    expect(parsed.manifest.updates).toMatchObject({ repo: 'dono/Jogo', assetPatterns: { win32: 'Jogo-*-win64.zip' } })
    expect(isGeneratedManifest({ ...parsed.manifest, origin: 'user' })).toBe(true)

    const raw = parseManifest(buildCustomManifest({ repo: 'dono/Jogo', platform: 'linux', assetName: 'Jogo-1.0-x86_64.AppImage', tag: '1.0' }))
    expect(raw.ok && raw.manifest.executables.linux).toEqual(['Jogo.appimage'])
  })

  it('repositórios diferentes nunca dividem o mesmo manifesto gerado', () => {
    const ids = ['a/b-c', 'a-b/c', 'a/b.c', 'a/b_c'].map(customManifestId)
    expect(new Set(ids).size).toBe(4)
    expect(customManifestId('Dono/Jogo')).toBe(customManifestId('dono/jogo'))
    const long = (n: string) => customManifestId(`dono/${'x'.repeat(60)}${n}`)
    expect(long('a')).not.toBe(long('b'))
    expect(long('a').length).toBeLessThanOrEqual(64)
  })

  it('só o manifesto gerado pelo app conta como gerado (nunca um escrito à mão ou embutido)', () => {
    const generated = { ...buildCustomManifest({ repo: 'dono/jogo', platform: 'win32', assetName: 'j.zip', tag: 'v1' }), origin: 'user' as const }
    expect(isGeneratedManifest(generated)).toBe(true)
    expect(isGeneratedManifest({ ...generated, origin: 'builtin' })).toBe(false)
    expect(isGeneratedManifest({ ...generated, id: 'meu-jogo' })).toBe(false)
    expect(isGeneratedManifest({ ...generated, updates: { ...generated.updates, repo: 'outro/jogo' } })).toBe(false)
    expect(isGeneratedManifest({ ...generated, updates: { source: 'none' } })).toBe(false)
  })

  it('acha o executável do jogo e deixa de lado desinstaladores e ajudantes', () => {
    const files = ['unins000.exe', 'MeuJogo.exe', 'bin/crashpad_handler.exe', 'tools/editor.exe', 'readme.txt'].map((rel) => ({ rel }))
    expect(rankExecutables(files, 'win32', 'meu-jogo')[0]).toBe('MeuJogo.exe')
    const linux = [{ rel: 'jogo', executable: true }, { rel: 'lib/libfoo.so' }, { rel: 'dados', executable: false }, { rel: 'Jogo.AppImage' }]
    expect(rankExecutables(linux, 'linux', 'jogo')).toEqual(['Jogo.AppImage', 'jogo'])
  })
})
