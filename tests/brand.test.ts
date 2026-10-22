import { readFileSync } from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { LOGO_PATHS, LOGO_VIEWBOX, SYMBOL_PATH, SYMBOL_VIEWBOX } from '../src/shared/brand'

const svg = (name: string) => readFileSync(path.join(__dirname, '..', 'docs', 'brand', name), 'utf8')
const pathsOf = (text: string) => [...text.matchAll(/<path[^>]*\sd="([^"]+)"/g)].map((m) => m[1])
const viewBoxOf = (text: string) => /viewBox="([^"]+)"/.exec(text)?.[1]

describe('marca do Relaunch', () => {
  it('o símbolo e o logo do app são os mesmos dos arquivos em docs/brand', () => {
    for (const variant of ['white', 'black']) {
      const symbol = svg(`relaunch-symbol-${variant}.svg`)
      expect(pathsOf(symbol)).toEqual([SYMBOL_PATH])
      expect(viewBoxOf(symbol)).toBe(SYMBOL_VIEWBOX)
      const logo = svg(`relaunch-logo-${variant}.svg`)
      expect(pathsOf(logo)).toEqual(LOGO_PATHS)
      expect(viewBoxOf(logo)).toBe(LOGO_VIEWBOX)
    }
  })
})
