import { promises as fs } from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { listConfigBackups, readConfigFile, restoreConfigBackup, saveConfigFile } from '../src/main/configFiles'
import { applyIniEdits, flattenJson, parseIniFields, setJsonPath, stringifyJsonLike, validateConfigText } from '../src/shared/configForm'
import { tempDir } from './helpers/fs'

describe('formulário de configs', () => {
  it('achata JSON aninhado e altera valores sem mutar o original', () => {
    const data = { CVars: { gHudColors: 1, gName: 'Link', nested: { on: true } }, list: [1, 2] }
    const fields = flattenJson(data)
    expect(fields.map((f) => f.label)).toEqual(['CVars.gHudColors', 'CVars.gName', 'CVars.nested.on', 'list[0]', 'list[1]'])
    const changed = setJsonPath(data, ['CVars', 'nested', 'on'], false)
    expect(changed.CVars.nested.on).toBe(false)
    expect(data.CVars.nested.on).toBe(true)
    expect(setJsonPath(data, ['list', 1], 5).list).toEqual([1, 5])
  })

  it('mantém a indentação e quebra de linha do arquivo original', () => {
    const original = '{\r\n    "a": 1\r\n}\r\n'
    expect(stringifyJsonLike(original, { a: 2 })).toBe('{\r\n    "a": 2\r\n}\r\n')
  })

  it('edita INI preservando comentários, ordem e espaçamento', () => {
    const text = '; comentário\n[Window][Debug]\nPos=60,60\nSize = 400,400\n\n[Docking]\nCollapsed=0\n'
    const fields = parseIniFields(text)
    expect(fields.map((f) => `${f.section}:${f.key}=${f.value}`)).toEqual(['Window][Debug:Pos=60,60', 'Window][Debug:Size=400,400', 'Docking:Collapsed=0'])
    const edited = applyIniEdits(text, [{ line: fields[1].line, value: '800,600' }])
    expect(edited).toBe('; comentário\n[Window][Debug]\nPos=60,60\nSize = 800,600\n\n[Docking]\nCollapsed=0\n')
  })

  it('valida antes de salvar', () => {
    expect(validateConfigText('json', '{"a":1}').ok).toBe(true)
    expect(validateConfigText('json', '{a:1}').ok).toBe(false)
    expect(validateConfigText('ini', '[s]\na=1\n; c\n').ok).toBe(true)
    expect(validateConfigText('ini', '[s]\nlinha solta\n').ok).toBe(false)
    expect(validateConfigText('text', 'qualquer coisa').ok).toBe(true)
  })
})

describe('salvar configs com backup automático', () => {
  it('faz backup antes de salvar e permite restaurar', async () => {
    const game = await tempDir()
    const backups = await tempDir()
    const spec = { path: 'shipofharkinian.json', format: 'json' as const, editable: true }
    const file = path.join(game, 'shipofharkinian.json')
    await fs.writeFile(file, '{"v":1}')

    const view = await readConfigFile(spec, 0, game, process.platform === 'win32' ? 'win32' : 'linux')
    expect(view).toMatchObject({ exists: true, content: '{"v":1}', path: file })

    await saveConfigFile({ spec, file, content: '{"v":2}', backupsRoot: backups, entryId: 'e1' })
    expect(await fs.readFile(file, 'utf8')).toBe('{"v":2}')
    const list = await listConfigBackups(backups, 'e1', file)
    expect(list).toHaveLength(1)

    await restoreConfigBackup(backups, 'e1', file, list[0].name)
    expect(await fs.readFile(file, 'utf8')).toBe('{"v":1}')
    expect(await listConfigBackups(backups, 'e1', file)).toHaveLength(2)
  })

  it('recusa conteúdo inválido sem tocar no arquivo', async () => {
    const game = await tempDir()
    const file = path.join(game, 'a.json')
    await fs.writeFile(file, '{"ok":true}')
    await expect(
      saveConfigFile({ spec: { path: 'a.json', format: 'json', editable: true }, file, content: '{quebrado', backupsRoot: game, entryId: 'e1' })
    ).rejects.toMatchObject({ code: 'INVALID_CONFIG' })
    expect(await fs.readFile(file, 'utf8')).toBe('{"ok":true}')
  })

  it('usa o primeiro caminho candidato que existir (ex.: modo portátil)', async () => {
    const game = await tempDir()
    const platform = process.platform === 'win32' ? 'win32' : 'linux'
    const spec = { path: ['general.json', '{home}/nao-existe/general.json'], format: 'json' as const, editable: true }
    const absent = await readConfigFile(spec, 0, game, platform)
    expect(absent?.exists).toBe(false)
    expect(absent?.path).toBe(path.join(game, 'general.json'))
    await fs.writeFile(path.join(game, 'general.json'), '{}')
    expect((await readConfigFile(spec, 0, game, platform))?.exists).toBe(true)
  })
})
