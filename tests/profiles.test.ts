import { describe, expect, it } from 'vitest'
import { ProfileService, type StoredProfile } from '../src/main/profiles'
import { profileInitials } from '../src/shared/profile'

function setup(initial: StoredProfile[] = []) {
  let saved = initial
  const store = { getProfiles: () => saved, setProfiles: (list: StoredProfile[]) => void (saved = list) }
  const waits: number[] = []
  const service = new ProfileService(store, async (ms) => void waits.push(ms))
  return { service, saved: () => saved, waits }
}

describe('perfis locais', () => {
  it('cria, entra e guarda o PIN só como hash', async () => {
    const { service, saved } = setup()
    const state = await service.create({ name: '  Ana Silva ', color: 1, pin: '1234' })
    expect(state.current).toMatchObject({ name: 'Ana Silva', color: 1, locked: true })
    const [stored] = saved()
    expect(stored.pin).not.toBeNull()
    expect(JSON.stringify(stored)).not.toContain('1234')
    expect(Object.keys(state.current!)).toEqual(['id', 'name', 'color', 'locked'])
  })

  it('rejeita nome vazio, PIN fora do formato, cor inexistente e nome repetido', async () => {
    const { service } = setup()
    await expect(service.create({ name: ' ', color: 0, pin: null })).rejects.toMatchObject({ code: 'INVALID_PROFILE', params: { field: 'name' } })
    await expect(service.create({ name: 'Ana', color: 0, pin: '12a4' })).rejects.toMatchObject({ code: 'INVALID_PROFILE', params: { field: 'pin' } })
    await expect(service.create({ name: 'Ana', color: 9, pin: null })).rejects.toMatchObject({ code: 'INVALID_PROFILE', params: { field: 'color' } })
    await expect(service.create({ name: 'x'.repeat(21), color: 0, pin: null })).rejects.toMatchObject({ code: 'INVALID_PROFILE' })
    await service.create({ name: 'Ana', color: 0, pin: null })
    await expect(service.create({ name: 'ANA', color: 2, pin: null })).rejects.toMatchObject({ code: 'PROFILE_EXISTS' })
  })

  it('PIN errado não entra e espera antes de responder; o certo entra', async () => {
    const { service, waits } = setup()
    const { current } = await service.create({ name: 'Ana', color: 0, pin: '4321' })
    service.leave()
    await expect(service.enter(current!.id, '0000')).rejects.toMatchObject({ code: 'WRONG_PIN' })
    await expect(service.enter(current!.id, undefined)).rejects.toMatchObject({ code: 'WRONG_PIN' })
    expect(waits).toEqual([500, 500])
    expect(service.state().current).toBeNull()
    expect((await service.enter(current!.id, '4321')).current?.id).toBe(current!.id)
  })

  it('só o perfil em uso pode ser alterado; trocar e remover o PIN', async () => {
    const { service } = setup()
    const ana = (await service.create({ name: 'Ana', color: 0, pin: null })).current!
    const bia = (await service.create({ name: 'Bia', color: 1, pin: null })).current!
    await expect(service.update(ana.id, { name: 'Outra' })).rejects.toMatchObject({ code: 'PERMISSION_DENIED' })
    await expect(service.update(bia.id, { name: 'ana' })).rejects.toMatchObject({ code: 'PROFILE_EXISTS' })
    expect((await service.update(bia.id, { name: 'Beatriz', pin: '1111' })).current).toMatchObject({ name: 'Beatriz', locked: true })
    service.leave()
    await service.enter(bia.id, '1111')
    expect((await service.update(bia.id, { pin: null })).current?.locked).toBe(false)
  })

  it('remover o perfil em uso volta para a tela de entrada', async () => {
    const { service } = setup()
    const ana = (await service.create({ name: 'Ana', color: 0, pin: null })).current!
    const state = service.remove(ana.id)
    expect(state).toEqual({ profiles: [], current: null })
  })

  it('exporta e importa o perfil com o PIN, recusando arquivo inválido ou nome repetido', async () => {
    const a = setup()
    await a.service.create({ name: 'Ana', color: 3, pin: '2468' })
    const { name, content } = a.service.exportCurrent()
    expect(name).toBe('Ana')
    expect(content).not.toContain('2468')

    const b = setup()
    const imported = b.service.importFile(content)
    expect(imported.current).toBeNull()
    const profile = imported.profiles[0]
    expect(profile).toMatchObject({ name: 'Ana', color: 3, locked: true })
    await expect(b.service.enter(profile.id, '1357')).rejects.toMatchObject({ code: 'WRONG_PIN' })
    expect((await b.service.enter(profile.id, '2468')).current?.name).toBe('Ana')

    expect(() => b.service.importFile(content)).toThrow(expect.objectContaining({ code: 'PROFILE_EXISTS' }))
    expect(() => b.service.importFile('{')).toThrow(expect.objectContaining({ code: 'INVALID_FILE' }))
    const tampered = JSON.parse(content)
    tampered.profile.pin.hash = 'x'
    expect(() => b.service.importFile(JSON.stringify({ ...tampered, profile: { ...tampered.profile, name: 'Outra' } }))).toThrow(
      expect.objectContaining({ code: 'INVALID_FILE' })
    )
  })

  it('o nome das versões antigas vira o primeiro perfil, uma vez só', () => {
    const { service, saved } = setup()
    service.seed('  Ana Silva  ')
    service.seed('Outro nome')
    expect(saved().map((p) => [p.name, p.pin])).toEqual([['Ana Silva', null]])
    setup().service.seed('   ')
  })

  it('iniciais do avatar seguem o design', () => {
    expect(profileInitials('André S.')).toBe('AS')
    expect(profileInitials('Convidado')).toBe('C')
    expect(profileInitials('maria clara souza')).toBe('MC')
    expect(profileInitials('  ')).toBe('?')
  })
})
