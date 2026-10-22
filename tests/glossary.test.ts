import { describe, expect, it } from 'vitest'
import { splitGlossary } from '../src/shared/glossary'

const terms = (text: string) => splitGlossary(text).flatMap((part) => (typeof part === 'string' ? [] : [`${part.id}:${part.text}`]))

describe('glossário', () => {
  it('marca os termos dos manifestos e mantém o texto em volta', () => {
    expect(splitGlossary('Gerar os assets a partir da sua ROM (oot.o2r)')).toEqual([
      'Gerar os ',
      { id: 'assets', text: 'assets' },
      ' a partir da sua ',
      { id: 'rom', text: 'ROM' },
      ' (',
      { id: 'o2r', text: 'oot.o2r' },
      ')'
    ])
    expect(terms('Arquivo de dados do port (2ship.o2r)')).toEqual(['port:port', 'o2r:2ship.o2r'])
    expect(terms('Port para PC de Ocarina of Time baseado na decompilação do jogo')).toEqual(['port:Port', 'decomp:decompilação'])
  })

  it('cada termo só ganha dica na primeira vez', () => {
    const help = 'Se você copiar a ROM para a pasta do jogo, ele a encontra. A verificação por SHA-1 vale para ROMs .z64; arquivos .n64/.v64 têm outro SHA-1.'
    expect(terms(help)).toEqual(['rom:ROM', 'sha1:SHA-1', 'romFormats:.z64'])
  })

  it('reconhece os termos em inglês', () => {
    expect(terms("Ports come from each project's official repository. ROMs and copyrighted assets are never downloaded.")).toEqual([
      'port:Ports',
      'rom:ROMs',
      'assets:assets'
    ])
    expect(terms('Checks every folder again and reloads the manifests.')).toEqual(['manifest:manifests'])
    expect(terms('Source: GitHub Releases of Zelda64Recomp/Zelda64Recomp')).toEqual(['release:Releases'])
    expect(terms('A PC port based on the decompilation')).toEqual(['port:port', 'decomp:decompilation'])
  })

  it('não marca pedaços de outras palavras, inclusive com acento', () => {
    for (const text of [
      'portão',
      'suporte',
      'Exportar perfil',
      'importar',
      'portable.txt',
      'PROMO',
      'from',
      'manifestar',
      'released',
      'assetsx',
      'sm64-port',
      'dono/port'
    ]) {
      expect(splitGlossary(text)).toEqual([text])
    }
    expect(splitGlossary('')).toEqual([])
  })
})
