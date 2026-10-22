import { promises as fs } from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { migrateLegacyUserData } from '../src/main/legacyData'
import { readTree, tempDir, writeTree } from './helpers/fs'

describe('migração da pasta de dados do RecompHub', () => {
  it('move biblioteca, backups e capas para a pasta nova e renomeia a biblioteca', async () => {
    const appData = await tempDir('appdata-')
    await writeTree(path.join(appData, 'RecompHub'), {
      'recomphub.json': '{"library":[1]}',
      'backups/soh/9.3.0/backup.zip': 'zip',
      'covers/e1.png': 'png',
      SingletonLock: 'trava'
    })
    const userData = path.join(appData, 'Relaunch')
    expect(migrateLegacyUserData(appData, userData)).toBe(true)
    expect(await readTree(userData)).toEqual({
      'relaunch.json': '{"library":[1]}',
      'backups/soh/9.3.0/backup.zip': 'zip',
      'covers/e1.png': 'png'
    })
    // A trava da instância antiga fica onde estava.
    expect(await fs.readdir(path.join(appData, 'RecompHub'))).toEqual(['SingletonLock'])
  })

  it('a pasta nova já criada (ex.: pela trava de instância única) não impede a migração', async () => {
    const appData = await tempDir('appdata-')
    await writeTree(path.join(appData, 'RecompHub'), { 'recomphub.json': 'antigo', 'covers/a.png': 'a' })
    const userData = path.join(appData, 'Relaunch')
    await writeTree(userData, { SingletonLock: 'nova' })
    expect(migrateLegacyUserData(appData, userData)).toBe(true)
    expect(await readTree(userData)).toEqual({ SingletonLock: 'nova', 'relaunch.json': 'antigo', 'covers/a.png': 'a' })
  })

  it('não faz nada quando a biblioteca nova já existe ou não há dados antigos', async () => {
    const appData = await tempDir('appdata-')
    const userData = path.join(appData, 'Relaunch')
    expect(migrateLegacyUserData(appData, userData)).toBe(false)
    await writeTree(path.join(appData, 'RecompHub'), { 'recomphub.json': 'antigo' })
    await writeTree(userData, { 'relaunch.json': 'novo' })
    expect(migrateLegacyUserData(appData, userData)).toBe(false)
    expect(await readTree(userData)).toEqual({ 'relaunch.json': 'novo' })
    expect(await readTree(path.join(appData, 'RecompHub'))).toEqual({ 'recomphub.json': 'antigo' })
  })
})
