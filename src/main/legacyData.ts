import { existsSync, mkdirSync, readdirSync, renameSync } from 'node:fs'
import path from 'node:path'

/** Nome do arquivo da biblioteca/configurações (electron-store), sem extensão. */
export const STORE_NAME = 'relaunch'

/** O Relaunch se chamava RecompHub: pasta de dados e arquivo da biblioteca com o nome antigo. */
const LEGACY_DIR = 'RecompHub'
const LEGACY_STORE = 'recomphub.json'

export interface LegacyMigration {
  /** Itens movidos da pasta antiga nesta execução. */
  moved: string[]
  /** Itens que não puderam ser movidos agora (ex.: arquivo em uso); a próxima abertura tenta de novo. */
  failed: { name: string; error: unknown }[]
  /** Quando a própria biblioteca não pôde ser movida: pasta a usar nesta sessão, para não abrir com a biblioteca vazia. */
  fallbackUserData?: string
}

/**
 * Traz os dados da pasta antiga (`<appData>/RecompHub`) para a pasta atual do app, movendo (sem copiar:
 * backups podem ser grandes) cada item que ainda não existir no destino. A biblioteca vai primeiro, antes que o
 * app crie uma vazia; o resto é retomado a cada abertura enquanto sobrar algo na pasta antiga.
 */
export function migrateLegacyUserData(appData: string, userData: string): LegacyMigration {
  const result: LegacyMigration = { moved: [], failed: [] }
  const legacy = path.join(appData, LEGACY_DIR)
  if (!existsSync(legacy)) return result
  mkdirSync(userData, { recursive: true })
  const move = (name: string, target: string) => {
    if (existsSync(target)) return
    try {
      renameSync(path.join(legacy, name), target)
      result.moved.push(name)
    } catch (error) {
      result.failed.push({ name, error })
    }
  }
  if (existsSync(path.join(legacy, LEGACY_STORE))) {
    move(LEGACY_STORE, path.join(userData, `${STORE_NAME}.json`))
    if (result.failed.length > 0) return { ...result, fallbackUserData: legacy }
  }
  for (const name of readdirSync(legacy)) {
    // Travas de instância única do Chromium pertencem à pasta antiga.
    if (name === LEGACY_STORE || name.startsWith('Singleton')) continue
    move(name, path.join(userData, name))
  }
  return result
}
