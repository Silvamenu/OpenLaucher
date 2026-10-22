import { existsSync, mkdirSync, readdirSync, renameSync } from 'node:fs'
import path from 'node:path'

/** Nome do arquivo da biblioteca/configurações (electron-store), sem extensão. */
export const STORE_NAME = 'relaunch'

/** O Relaunch se chamava RecompHub: pasta de dados e arquivo da biblioteca com o nome antigo. */
const LEGACY_DIR = 'RecompHub'
const LEGACY_STORE = 'recomphub.json'

/**
 * Traz os dados da pasta antiga (`<appData>/RecompHub`) para a pasta atual do app na primeira execução
 * com o nome novo. Move cada item (sem copiar: backups podem ser grandes) que ainda não existir no destino
 * e renomeia a biblioteca por último, para que uma falha no meio seja retomada na próxima abertura.
 * Não faz nada quando a biblioteca nova já existe ou quando não há dados antigos.
 * Retorna true quando migrou.
 */
export function migrateLegacyUserData(appData: string, userData: string): boolean {
  const legacy = path.join(appData, LEGACY_DIR)
  const store = path.join(userData, `${STORE_NAME}.json`)
  if (existsSync(store) || !existsSync(path.join(legacy, LEGACY_STORE))) return false
  mkdirSync(userData, { recursive: true })
  for (const name of readdirSync(legacy)) {
    // Travas de instância única do Chromium pertencem à pasta antiga.
    if (name === LEGACY_STORE || name.startsWith('Singleton')) continue
    const target = path.join(userData, name)
    if (!existsSync(target)) renameSync(path.join(legacy, name), target)
  }
  renameSync(path.join(legacy, LEGACY_STORE), store)
  return true
}
