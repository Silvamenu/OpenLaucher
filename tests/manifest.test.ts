import { promises as fs } from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { loadManifests } from '../src/main/manifests'
import { assetPatternsFor, collectTodos, configPathCandidates, executablesFor, launchArgsFor, parseManifest, parseManifestText } from '../src/shared/manifest'
import { tempDir } from './helpers/fs'

const minimal = {
  id: 'demo',
  name: 'Demo',
  repoUrl: 'https://github.com/example/demo',
  executables: { win32: ['demo.exe'] },
  detectFiles: ['demo.exe']
}

describe('parser de manifestos', () => {
  it('aceita um manifesto mínimo e aplica padrões', () => {
    const result = parseManifest(minimal)
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.manifest.requirements).toEqual([])
    expect(result.manifest.configFiles).toEqual([])
    expect(result.manifest.updates).toEqual({ source: 'none' })
    expect(launchArgsFor(result.manifest, 'win32')).toEqual([])
  })

  it('gera ids para requisitos sem id e rejeita ids duplicados', () => {
    const ok = parseManifest({
      ...minimal,
      requirements: [
        { type: 'file', label: 'A', patterns: ['a.bin'] },
        { type: 'firstRun', label: 'B' }
      ]
    })
    expect(ok.ok && ok.manifest.requirements.map((r) => r.id)).toEqual(['file-1', 'firstRun-2'])

    const dup = parseManifest({
      ...minimal,
      requirements: [
        { id: 'x', type: 'file', label: 'A', patterns: ['a'] },
        { id: 'x', type: 'firstRun', label: 'B' }
      ]
    })
    expect(dup.ok).toBe(false)
    if (!dup.ok) expect(dup.error).toContain('duplicado')
  })

  it('rejeita campos inválidos com mensagem indicando o caminho', () => {
    const cases: [unknown, string][] = [
      [{ ...minimal, id: 'Com Espaço' }, 'id'],
      [{ ...minimal, repoUrl: 'http://github.com/x/y' }, 'repoUrl'],
      [{ ...minimal, detectFiles: [] }, 'detectFiles'],
      [{ ...minimal, executables: {} }, 'executables'],
      [{ ...minimal, requirements: [{ type: 'desconhecido', label: 'x' }] }, 'requirements'],
      [{ ...minimal, requirements: [{ type: 'userFile', label: 'ROM', validation: { sha1: ['123'] } }] }, 'sha1'],
      [{ ...minimal, updates: { source: 'github-releases', repo: 'sem-barra', assetPatterns: {} } }, 'updates.repo'],
      [{ ...minimal, configFiles: [{ path: 'a.yaml', format: 'yaml' }] }, 'configFiles']
    ]
    for (const [input, where] of cases) {
      const result = parseManifest(input)
      expect(result.ok, JSON.stringify(input)).toBe(false)
      if (!result.ok) expect(result.error).toContain(where)
    }
  })

  it('relata JSON malformado', () => {
    const result = parseManifestText('{ "id": ')
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.error).toMatch(/JSON inválido/)
  })

  it('ignora chaves extras e coleta pendências "_todo"', () => {
    const result = parseManifest({
      ...minimal,
      _todo: 'confirmar executável',
      _comment: 'ignorado',
      requirements: [{ type: 'file', label: 'A', patterns: ['a'], _todo: ['hash?'] }],
      updates: { source: 'none', _todo: 'sem binários' }
    })
    expect(result.ok).toBe(true)
    if (result.ok) expect(collectTodos(result.manifest)).toEqual(['confirmar executável', 'hash?', 'sem binários'])
  })

  it('resolve valores por plataforma', () => {
    const result = parseManifest({
      ...minimal,
      executables: { win32: ['a.exe'], linux: ['a.appimage'] },
      launchArgs: { win32: ['--x'] },
      configFiles: [{ path: { win32: ['a.json', '{appData}/a.json'], linux: 'b.json' }, format: 'json' }],
      updates: { source: 'github-releases', repo: 'o/r', assetPatterns: { win32: '*win*.zip', linux: ['*.appimage', '*linux*.zip'] } }
    })
    expect(result.ok).toBe(true)
    if (!result.ok) return
    const m = result.manifest
    expect(executablesFor(m, 'linux')).toEqual(['a.appimage'])
    expect(executablesFor(m, 'darwin')).toEqual([])
    expect(launchArgsFor(m, 'win32')).toEqual(['--x'])
    expect(launchArgsFor(m, 'linux')).toEqual([])
    expect(configPathCandidates(m.configFiles[0], 'win32')).toEqual(['a.json', '{appData}/a.json'])
    expect(configPathCandidates(m.configFiles[0], 'linux')).toEqual(['b.json'])
    if (m.updates.source !== 'github-releases') throw new Error('esperado github-releases')
    expect(assetPatternsFor(m.updates, 'win32')).toEqual(['*win*.zip'])
    expect(assetPatternsFor(m.updates, 'linux')).toEqual(['*.appimage', '*linux*.zip'])
    expect(m.updates.includePrereleases).toBe(false)
    expect(m.updates.preserve).toEqual([])
  })
})

describe('manifestos embutidos', () => {
  const dir = path.join(__dirname, '..', 'manifests')

  it('todos os arquivos em manifests/ são válidos', async () => {
    const report = await loadManifests([{ dir, origin: 'builtin' }])
    expect(report.errors).toEqual([])
    expect(report.manifests.map((m) => m.id).sort()).toEqual(['2ship', 'sm64-port', 'soh', 'spaghettikart', 'starship', 'zelda64recomp'])
  })

  it('projetos com binários publicados declaram assets para Windows e preservam dados do usuário', async () => {
    const { manifests } = await loadManifests([{ dir, origin: 'builtin' }])
    for (const m of manifests) {
      if (m.updates.source !== 'github-releases') continue
      expect(assetPatternsFor(m.updates, 'win32').length, m.id).toBeGreaterThan(0)
      expect(m.updates.preserve.length, m.id).toBeGreaterThan(0)
      expect(m.repoUrl.toLowerCase()).toContain(m.updates.repo.toLowerCase())
    }
    const soh = manifests.find((m) => m.id === 'soh')!
    // soh.o2r pertence ao port e PRECISA ser atualizado; só os arquivos gerados da ROM são preservados.
    if (soh.updates.source === 'github-releases') {
      expect(soh.updates.preserve).toContain('oot.o2r')
      expect(soh.updates.preserve).not.toContain('*.o2r')
    }
  })

  it('manifesto do usuário substitui o embutido com o mesmo id e erros são reportados', async () => {
    const userDir = await tempDir()
    await fs.writeFile(path.join(userDir, 'soh.json'), JSON.stringify({ ...minimal, id: 'soh', name: 'SoH (meu)' }))
    await fs.writeFile(path.join(userDir, 'quebrado.json'), '{')
    await fs.writeFile(path.join(userDir, 'nome-errado.json'), JSON.stringify(minimal))
    const report = await loadManifests([
      { dir, origin: 'builtin' },
      { dir: userDir, origin: 'user' }
    ])
    const soh = report.manifests.find((m) => m.id === 'soh')!
    expect(soh.name).toBe('SoH (meu)')
    expect(soh.origin).toBe('user')
    expect(report.errors.map((e) => path.basename(e.file)).sort()).toEqual(['nome-errado.json', 'quebrado.json'])
  })
})
