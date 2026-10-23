import os from 'node:os'
import path from 'node:path'
import type { Platform } from '../shared/manifest'

export interface PathContext {
  gameDir: string
  platform: Platform
  env?: NodeJS.ProcessEnv
  home?: string
}

/** Valores das variáveis de caminho aceitas nos manifestos. */
export function pathVariables(ctx: PathContext): Record<string, string> {
  const env = ctx.env ?? process.env
  const home = ctx.home ?? os.homedir()
  if (ctx.platform === 'win32') {
    return {
      gameDir: ctx.gameDir,
      home,
      appData: env.APPDATA ?? path.join(home, 'AppData', 'Roaming'),
      localAppData: env.LOCALAPPDATA ?? path.join(home, 'AppData', 'Local'),
      documents: path.join(env.USERPROFILE ?? home, 'Documents')
    }
  }
  if (ctx.platform === 'darwin') {
    const support = path.join(home, 'Library', 'Application Support')
    return { gameDir: ctx.gameDir, home, appData: support, localAppData: support, documents: path.join(home, 'Documents') }
  }
  return {
    gameDir: ctx.gameDir,
    home,
    appData: env.XDG_CONFIG_HOME || path.join(home, '.config'),
    localAppData: env.XDG_DATA_HOME || path.join(home, '.local', 'share'),
    documents: path.join(home, 'Documents')
  }
}

const VAR_RE = /\{(\w+)\}/g

export function hasPathVariables(template: string): boolean {
  return /\{\w+\}/.test(template)
}

/** Substitui {variáveis}. Caminhos relativos sem variáveis são resolvidos a partir da pasta do jogo. */
export function resolvePathTemplate(template: string, ctx: PathContext): string {
  const replaced = expandVariables(template, ctx)
  const native = ctx.platform === 'win32' ? replaced.replace(/\//g, '\\') : replaced
  return path.isAbsolute(native) ? path.normalize(native) : path.join(ctx.gameDir, native)
}

/** Substitui variáveis em valores livres (ex.: variáveis de ambiente), sem resolver caminho. `extra` soma variáveis (ex.: {gameFile}). */
export function expandVariables(value: string, ctx: PathContext, extra: Record<string, string> = {}): string {
  const vars: Record<string, string> = { ...pathVariables(ctx), ...extra }
  return value.replace(VAR_RE, (whole, name: string) => vars[name] ?? whole)
}
