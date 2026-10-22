import { randomBytes, randomUUID, scrypt, timingSafeEqual } from 'node:crypto'
import { z } from 'zod'
import { AppError } from '../shared/errors'
import { PIN_PATTERN, PROFILE_COLORS, PROFILE_NAME_MAX } from '../shared/profile'
import type { ProfilesState, ProfileView } from '../shared/types'

/** PIN guardado como hash scrypt com sal aleatório (base64); o PIN em si nunca é salvo. */
export interface PinHash {
  salt: string
  hash: string
}

export interface StoredProfile {
  id: string
  name: string
  color: number
  pin: PinHash | null
  createdAt: string
}

export interface ProfileStore {
  getProfiles(): readonly StoredProfile[]
  setProfiles(profiles: StoredProfile[]): void
}

const KEY_LENGTH = 32
/** Espera depois de um PIN errado: freia tentativas em sequência. */
const WRONG_PIN_DELAY_MS = 500
/** Arquivo .relaunch (exportar/importar perfil). */
const FILE_FORMAT = 'relaunch-profile'
const FILE_VERSION = 1

function derive(pin: string, salt: Buffer): Promise<Buffer> {
  return new Promise((resolve, reject) => scrypt(pin, salt, KEY_LENGTH, (err, key) => (err ? reject(err) : resolve(key))))
}

async function hashPin(pin: string): Promise<PinHash> {
  const salt = randomBytes(16)
  return { salt: salt.toString('base64'), hash: (await derive(pin, salt)).toString('base64') }
}

async function pinMatches(pin: string, stored: PinHash): Promise<boolean> {
  const expected = Buffer.from(stored.hash, 'base64')
  if (expected.length !== KEY_LENGTH) return false
  return timingSafeEqual(await derive(pin, Buffer.from(stored.salt, 'base64')), expected)
}

const nameSchema = z.string().trim().min(1).max(PROFILE_NAME_MAX)
const colorSchema = z
  .number()
  .int()
  .min(0)
  .max(PROFILE_COLORS.length - 1)
const pinSchema = z.string().regex(PIN_PATTERN)
const newProfileSchema = z.object({ name: nameSchema, color: colorSchema, pin: pinSchema.nullable() })
const patchSchema = z.object({ name: nameSchema.optional(), color: colorSchema.optional(), pin: pinSchema.nullable().optional() })
const fileSchema = z.object({
  format: z.literal(FILE_FORMAT),
  version: z.literal(FILE_VERSION),
  profile: z.object({
    name: nameSchema,
    color: colorSchema,
    // 16 bytes de sal e 32 de hash em base64.
    pin: z.object({ salt: z.string().regex(/^[A-Za-z0-9+/]{22}==$/), hash: z.string().regex(/^[A-Za-z0-9+/]{43}=$/) }).nullable()
  })
})

/** Valida dados vindos da interface; o erro diz qual campo falhou (name ou pin). */
function parse<T>(schema: z.ZodType<T>, input: unknown): T {
  const result = schema.safeParse(input)
  if (result.success) return result.data
  const field = String(result.error.issues[0]?.path[0] ?? 'name')
  throw new AppError('INVALID_PROFILE', field, { field })
}

function toView(profile: StoredProfile): ProfileView {
  return { id: profile.id, name: profile.name, color: profile.color, locked: profile.pin !== null }
}

/**
 * Perfis locais ("Quem está jogando?"). Ficam só no arquivo de dados do app; o PIN
 * evita entrar no perfil de outra pessoa por engano, não cifra nada do computador.
 */
export class ProfileService {
  private currentId: string | null = null

  constructor(
    private readonly store: ProfileStore,
    private readonly wait = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms))
  ) {}

  /** Versões sem perfis guardavam só um nome: ele vira o primeiro perfil. */
  seed(name: string): void {
    const clean = name.trim().slice(0, PROFILE_NAME_MAX).trim()
    if (clean && this.store.getProfiles().length === 0) {
      this.store.setProfiles([{ id: randomUUID(), name: clean, color: 0, pin: null, createdAt: new Date().toISOString() }])
    }
  }

  state(): ProfilesState {
    const profiles = this.store.getProfiles()
    const current = profiles.find((p) => p.id === this.currentId)
    return { profiles: profiles.map(toView), current: current ? toView(current) : null }
  }

  async create(input: unknown): Promise<ProfilesState> {
    const { name, color, pin } = parse(newProfileSchema, input)
    this.assertNameFree(name)
    const profile: StoredProfile = { id: randomUUID(), name, color, pin: pin ? await hashPin(pin) : null, createdAt: new Date().toISOString() }
    this.store.setProfiles([...this.store.getProfiles(), profile])
    this.currentId = profile.id
    return this.state()
  }

  async enter(id: string, pin: unknown): Promise<ProfilesState> {
    const profile = this.require(id)
    if (profile.pin) {
      const ok = typeof pin === 'string' && PIN_PATTERN.test(pin) && (await pinMatches(pin, profile.pin))
      if (!ok) {
        await this.wait(WRONG_PIN_DELAY_MS)
        throw new AppError('WRONG_PIN')
      }
    }
    this.currentId = profile.id
    return this.state()
  }

  leave(): ProfilesState {
    this.currentId = null
    return this.state()
  }

  /** Só o perfil em uso pode ser alterado (quem entrou nele já passou pelo PIN). */
  async update(id: string, input: unknown): Promise<ProfilesState> {
    const profile = this.require(id)
    if (profile.id !== this.currentId) throw new AppError('PERMISSION_DENIED', id)
    const patch = parse(patchSchema, input)
    if (patch.name !== undefined) this.assertNameFree(patch.name, id)
    let pin = profile.pin
    if (patch.pin !== undefined) pin = patch.pin === null ? null : await hashPin(patch.pin)
    const next: StoredProfile = { ...profile, name: patch.name ?? profile.name, color: patch.color ?? profile.color, pin }
    this.store.setProfiles(this.store.getProfiles().map((p) => (p.id === id ? next : p)))
    return this.state()
  }

  /** Qualquer perfil pode ser removido (é o caminho para quem esqueceu o PIN); a biblioteca não muda. */
  remove(id: string): ProfilesState {
    this.require(id)
    this.store.setProfiles(this.store.getProfiles().filter((p) => p.id !== id))
    if (this.currentId === id) this.currentId = null
    return this.state()
  }

  /** Conteúdo do arquivo .relaunch do perfil em uso (o PIN vai só como hash). */
  exportCurrent(): { name: string; content: string } {
    const profile = this.store.getProfiles().find((p) => p.id === this.currentId)
    if (!profile) throw new AppError('NOT_FOUND')
    const file = { format: FILE_FORMAT, version: FILE_VERSION, profile: { name: profile.name, color: profile.color, pin: profile.pin } }
    return { name: profile.name, content: JSON.stringify(file, null, 2) }
  }

  importFile(content: string): ProfilesState {
    let data: unknown
    try {
      data = JSON.parse(content)
    } catch {
      throw new AppError('INVALID_FILE')
    }
    const result = fileSchema.safeParse(data)
    if (!result.success) throw new AppError('INVALID_FILE')
    const { name, color, pin } = result.data.profile
    this.assertNameFree(name)
    this.store.setProfiles([...this.store.getProfiles(), { id: randomUUID(), name, color, pin, createdAt: new Date().toISOString() }])
    return this.state()
  }

  private require(id: string): StoredProfile {
    const profile = this.store.getProfiles().find((p) => p.id === id)
    if (!profile) throw new AppError('NOT_FOUND', id)
    return profile
  }

  private assertNameFree(name: string, exceptId?: string): void {
    const taken = this.store.getProfiles().some((p) => p.id !== exceptId && p.name.toLowerCase() === name.toLowerCase())
    if (taken) throw new AppError('PROFILE_EXISTS', name)
  }
}
