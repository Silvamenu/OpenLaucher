import { promises as fs } from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { migrateLegacyUserData } from '../src/main/legacyData'
import { readTree, tempDir, writeTree } from './helpers/fs'

async function setup(legacy: Record<string, string>, current?: Record<string, string>) {
  const appData = await tempDir('appdata-')
  await writeTree(path.join(appData, 'RecompHub'), legacy)
  const userData = path.join(appData, 'Relaunch')
  if (current) await writeTree(userData, current)
  return { appData, userData, legacy: path.join(appData, 'RecompHub') }
}

describe('migração da pasta de dados do RecompHub', () => {
  it('move biblioteca, backups e capas para a pasta nova e renomeia a biblioteca', async () => {
    const { appData, userData, legacy } = await setup({
      'recomphub.json': '{"library":[1]}',
      'backups/soh/9.3.0/backup.zip': 'zip',
      'covers/e1.png': 'png',
      SingletonLock: 'trava'
    })
    const result = migrateLegacyUserData(appData, userData)
    expect(result.failed).toEqual([])
    expect(result.moved.sort()).toEqual(['backups', 'covers', 'recomphub.json'])
    expect(await readTree(userData)).toEqual({
      'relaunch.json': '{"library":[1]}',
      'backups/soh/9.3.0/backup.zip': 'zip',
      'covers/e1.png': 'png'
    })
    // A trava da instância antiga fica onde estava.
    expect(await fs.readdir(legacy)).toEqual(['SingletonLock'])
  })

  it('a pasta nova já criada (ex.: pela trava de instância única) não impede a migração', async () => {
    const { appData, userData } = await setup({ 'recomphub.json': 'antigo', 'covers/a.png': 'a' }, { SingletonLock: 'nova' })
    migrateLegacyUserData(appData, userData)
    expect(await readTree(userData)).toEqual({ SingletonLock: 'nova', 'relaunch.json': 'antigo', 'covers/a.png': 'a' })
  })

  it('retoma na próxima abertura o que não pôde ser movido, sem sobrescrever a biblioteca nova', async () => {
    // Primeira abertura: a biblioteca foi movida, mas os backups ficaram para trás (ex.: arquivo em uso).
    const { appData, userData } = await setup({ 'backups/soh/backup.zip': 'zip' }, { 'relaunch.json': 'migrada' })
    const result = migrateLegacyUserData(appData, userData)
    expect(result.moved).toEqual(['backups'])
    expect(await readTree(userData)).toEqual({ 'relaunch.json': 'migrada', 'backups/soh/backup.zip': 'zip' })
  })

  it('nunca sobrescreve itens que já existem na pasta nova', async () => {
    const { appData, userData, legacy } = await setup(
      { 'recomphub.json': 'antigo', 'covers/a.png': 'antiga' },
      { 'relaunch.json': 'novo', 'covers/a.png': 'nova' }
    )
    expect(migrateLegacyUserData(appData, userData).moved).toEqual([])
    expect(await readTree(userData)).toEqual({ 'relaunch.json': 'novo', 'covers/a.png': 'nova' })
    expect(await readTree(legacy)).toEqual({ 'recomphub.json': 'antigo', 'covers/a.png': 'antiga' })
  })

  it('sem pasta antiga, não faz nada', async () => {
    const appData = await tempDir('appdata-')
    expect(migrateLegacyUserData(appData, path.join(appData, 'Relaunch'))).toEqual({ moved: [], failed: [] })
    expect(await fs.readdir(appData)).toEqual([])
  })
})
