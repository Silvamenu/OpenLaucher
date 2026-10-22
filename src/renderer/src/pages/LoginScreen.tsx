import { Delete, Lock, Plus, ShieldCheck } from 'lucide-react'
import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react'
import { PIN_PATTERN, PROFILE_COLORS, PROFILE_NAME_MAX } from '../../../shared/profile'
import type { ProfilesState, ProfileView } from '../../../shared/types'
import { Logo } from '../components/brand'
import { ProfileAvatar } from '../components/ProfileAvatar'
import { useI18n } from '../i18n'
import { errorMessage, isApiError } from '../lib/format'
import { useAppState } from '../state/AppState'

// Tela própria, sempre escura (como no design): cores fixas em vez dos tokens do tema.
const INK = '#f5f5f4'
const MUTED = '#a9a9a6'
const SOFT = '#c9c9c6'
const ERROR = '#ff9b8f'
const KEYS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '', '0', 'del'] as const

type Step = 'pick' | 'pin' | 'create' | 'enter'

function Tile({ onClick, label, labelColor = INK, children }: { onClick: () => void; label: string; labelColor?: string; children: ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex w-[132px] cursor-pointer flex-col items-center gap-3.5 rounded-[18px] py-2.5 transition-colors hover:bg-[rgba(245,245,244,.05)]"
    >
      {children}
      <span className="max-w-[132px] truncate text-[15px]" style={{ color: labelColor, fontWeight: labelColor === INK ? 500 : 400 }}>
        {label}
      </span>
    </button>
  )
}

/** "Quem está jogando?": escolher, desbloquear (PIN) ou criar um perfil local antes de abrir o launcher. */
export function LoginScreen() {
  const { profiles, setProfiles, info, navigate } = useAppState()
  const { t } = useI18n()
  const [step, setStep] = useState<Step>('pick')
  const [cur, setCur] = useState<ProfileView | null>(null)
  const [pin, setPin] = useState('')
  const [pinError, setPinError] = useState('')
  const [checking, setChecking] = useState(false)
  const [newName, setNewName] = useState('')
  const [newColor, setNewColor] = useState(0)
  const [usePin, setUsePin] = useState(false)
  const [newPin, setNewPin] = useState('')
  const [createError, setCreateError] = useState('')
  const [filled, setFilled] = useState(false)
  const [toast, setToast] = useState('')
  const toastTimer = useRef<ReturnType<typeof setTimeout>>(undefined)
  const entered = useRef<ProfilesState | null>(null)
  const list = profiles?.profiles ?? []

  const say = useCallback((text: string) => {
    clearTimeout(toastTimer.current)
    setToast(text)
    toastTimer.current = setTimeout(() => setToast(''), 2600)
  }, [])
  useEffect(() => () => clearTimeout(toastTimer.current), [])

  /** Animação "Olá, Fulano" e só então o launcher. */
  const enter = useCallback((state: ProfilesState) => {
    entered.current = state
    setCur(state.current)
    setFilled(false)
    setStep('enter')
  }, [])
  useEffect(() => {
    if (step !== 'enter') return
    const frame = requestAnimationFrame(() => setFilled(true))
    const done = setTimeout(() => {
      navigate({ page: 'library' })
      if (entered.current) setProfiles(entered.current)
    }, 930)
    return () => {
      cancelAnimationFrame(frame)
      clearTimeout(done)
    }
  }, [step, navigate, setProfiles])

  const pick = async (profile: ProfileView) => {
    if (profile.locked) {
      setCur(profile)
      setPin('')
      setPinError('')
      setStep('pin')
      return
    }
    try {
      enter(await window.api.profiles.enter(profile.id))
    } catch (err) {
      say(errorMessage(err, t))
    }
  }

  const press = useCallback(
    (key: string) => {
      if (checking || !cur) return
      if (key === 'del') {
        setPin((p) => p.slice(0, -1))
        setPinError('')
        return
      }
      if (pin.length >= 4) return
      const next = pin + key
      setPin(next)
      setPinError('')
      if (next.length < 4) return
      setChecking(true)
      setTimeout(() => {
        window.api.profiles
          .enter(cur.id, next)
          .then(enter)
          .catch((err) => {
            setPin('')
            setPinError(isApiError(err, 'WRONG_PIN') ? t('error.WRONG_PIN') : errorMessage(err, t))
          })
          .finally(() => setChecking(false))
      }, 180)
    },
    [checking, cur, pin, t, enter]
  )

  // Teclado físico no PIN: dígitos, apagar e Esc para voltar.
  useEffect(() => {
    if (step !== 'pin') return
    const onKey = (e: KeyboardEvent) => {
      if (/^[0-9]$/.test(e.key)) press(e.key)
      else if (e.key === 'Backspace') press('del')
      else if (e.key === 'Escape') setStep('pick')
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [step, press])

  const goCreate = () => {
    setNewName('')
    setNewPin('')
    setUsePin(false)
    setCreateError('')
    setNewColor(list.length % 4)
    setStep('create')
  }

  const canCreate = newName.trim() !== '' && (!usePin || PIN_PATTERN.test(newPin))
  const create = async () => {
    if (!newName.trim()) return setCreateError(t('login.error.name'))
    if (usePin && !PIN_PATTERN.test(newPin)) return setCreateError(t('login.error.pin'))
    try {
      enter(await window.api.profiles.create({ name: newName, color: newColor, pin: usePin ? newPin : null }))
    } catch (err) {
      const field = (err as { params?: { field?: string } }).params?.field
      setCreateError(field === 'pin' ? t('login.error.pin') : field === 'name' ? t('login.error.name') : errorMessage(err, t))
    }
  }

  const importProfile = async () => {
    try {
      const state = await window.api.profiles.import()
      if (state) {
        setProfiles(state)
        say(t('login.imported'))
      }
    } catch (err) {
      say(errorMessage(err, t))
    }
  }

  const fieldClass =
    'h-[46px] rounded-xl border border-[#2c2c30] bg-[rgba(20,20,22,.7)] px-3.5 text-[#f5f5f4] outline-none placeholder:text-[#6b6b70] focus:border-[#3a3a40]'

  return (
    <div className="h-full overflow-y-auto bg-[#141416] text-[#f5f5f4] antialiased">
      <div className="relative flex min-h-full flex-col overflow-hidden" style={{ minHeight: 'max(100%, 620px)' }}>
        {/* Manchas de cor desfocadas e granulado, como no design */}
        <div className="pointer-events-none absolute -inset-[15%] blur-[110px]" aria-hidden>
          <div className="absolute rounded-full" style={{ left: '62%', top: '-4%', width: '22%', height: '36%', background: '#2d4fe6' }} />
          <div className="absolute rounded-full" style={{ left: '78%', top: '-8%', width: '24%', height: '34%', background: '#f2773a' }} />
          <div className="absolute rounded-full" style={{ left: '-8%', top: '70%', width: '26%', height: '36%', background: '#6eb2f2' }} />
          <div className="absolute rounded-full" style={{ left: '6%', top: '84%', width: '22%', height: '30%', background: '#f2c54b' }} />
        </div>
        <svg className="pointer-events-none absolute inset-0 h-full w-full opacity-45 mix-blend-overlay" aria-hidden>
          <filter id="login-noise">
            <feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves={3} stitchTiles="stitch" />
            <feColorMatrix type="saturate" values="0" />
          </filter>
          <rect width="100%" height="100%" filter="url(#login-noise)" />
        </svg>

        <header className="relative flex items-center px-10 py-7">
          <Logo height={26} className="text-[#f5f5f4]" title={t('app.name')} />
        </header>

        <div className="relative flex flex-1 items-center justify-center px-6 pt-6 pb-16">
          {step === 'pick' && (
            <div className="flex w-full max-w-[720px] flex-col items-center text-center">
              <h1 className="text-[clamp(30px,4vw,44px)] font-semibold tracking-[-0.035em]">{t('login.title')}</h1>
              <div className="mt-11 flex flex-wrap justify-center gap-7">
                {list.map((profile) => (
                  <Tile key={profile.id} label={profile.name} onClick={() => void pick(profile)}>
                    <div className="relative">
                      <ProfileAvatar profile={profile} size={96} fontSize={30} ring />
                      {profile.locked && (
                        <span className="absolute -right-0.5 -bottom-0.5 grid h-[30px] w-[30px] place-items-center rounded-full border-2 border-[#141416] bg-[#1f1f22]">
                          <Lock size={13} strokeWidth={2.2} color={SOFT} />
                        </span>
                      )}
                    </div>
                  </Tile>
                ))}
                <Tile label={t('login.newProfile')} labelColor={SOFT} onClick={goCreate}>
                  <div className="grid h-24 w-24 place-items-center rounded-full border-[1.5px] border-dashed border-[rgba(245,245,244,.35)]">
                    <Plus size={26} strokeWidth={1.8} color={SOFT} />
                  </div>
                </Tile>
              </div>
              <p className="mt-12 flex items-center gap-2.5 text-[13px]" style={{ color: MUTED }}>
                <ShieldCheck size={14} />
                {t('login.localOnly')}
              </p>
            </div>
          )}

          {step === 'pin' && cur && (
            <div className="flex w-full max-w-[360px] flex-col items-center text-center">
              <ProfileAvatar profile={cur} size={96} fontSize={30} />
              <div className="mt-5 text-[26px] font-semibold tracking-[-0.025em]">{cur.name}</div>
              <div className="mt-1.5 text-[14px]" style={{ color: MUTED }}>
                {t('login.enterPin')}
              </div>
              <div className="mt-7 flex gap-3.5" role="status" aria-label={t('login.pinDots', { n: pin.length })}>
                {[0, 1, 2, 3].map((i) => (
                  <span
                    key={i}
                    className="h-4 w-4 rounded-full transition-[background] duration-150"
                    style={{ border: `1.5px solid ${pinError ? ERROR : 'rgba(245,245,244,.5)'}`, background: i < pin.length ? INK : 'transparent' }}
                  />
                ))}
              </div>
              <div className="mt-4 h-5 text-[13px]" style={{ color: ERROR }}>
                {pinError}
              </div>
              <div className="mt-5 grid grid-cols-[repeat(3,64px)] gap-2.5">
                {KEYS.map((key, i) =>
                  key ? (
                    <button
                      key={key}
                      type="button"
                      aria-label={key === 'del' ? t('login.delete') : key}
                      onClick={() => press(key)}
                      className="grid h-14 cursor-pointer place-items-center rounded-[14px] bg-[rgba(245,245,244,.06)] text-[20px] font-medium transition-colors hover:bg-[rgba(245,245,244,.12)]"
                      style={{ color: key === 'del' ? SOFT : INK }}
                    >
                      {key === 'del' ? <Delete size={20} strokeWidth={1.8} /> : key}
                    </button>
                  ) : (
                    <span key={`blank-${i}`} />
                  )
                )}
              </div>
              <div className="mt-7 flex gap-5 text-[13.5px]">
                <button type="button" className="cursor-pointer" style={{ color: SOFT }} onClick={() => setStep('pick')}>
                  {t('login.switch')}
                </button>
                <button type="button" className="cursor-pointer text-[#9ccaf2] hover:text-[#cfe2ff]" onClick={() => say(t('login.forgotPinHint'))}>
                  {t('login.forgotPin')}
                </button>
              </div>
            </div>
          )}

          {step === 'create' && (
            <form
              className="w-full max-w-[400px]"
              onSubmit={(e) => {
                e.preventDefault()
                void create()
              }}
            >
              <h1 className="text-[30px] font-semibold tracking-[-0.03em]">{t('login.newProfile')}</h1>
              <p className="mt-1.5 text-[14px] leading-normal" style={{ color: MUTED }}>
                {t('login.createSubtitle')}
              </p>
              <div className="mt-7 flex items-center gap-4">
                <ProfileAvatar profile={{ name: newName, color: newColor }} size={64} fontSize={22} />
                <div className="flex flex-wrap gap-2">
                  {PROFILE_COLORS.slice(0, 4).map((bg, i) => (
                    <button
                      key={bg}
                      type="button"
                      aria-label={t('settings.profileColor')}
                      aria-pressed={i === newColor}
                      onClick={() => setNewColor(i)}
                      className="h-7 w-7 cursor-pointer rounded-full"
                      style={{ background: bg, boxShadow: `0 0 0 2px #141416, 0 0 0 ${i === newColor ? 4 : 0}px ${INK}` }}
                    />
                  ))}
                </div>
              </div>
              <label htmlFor="new-profile-name" className="mt-6 mb-2 block text-[12.5px]" style={{ color: MUTED }}>
                {t('login.name')}
              </label>
              <input
                id="new-profile-name"
                autoFocus
                value={newName}
                maxLength={PROFILE_NAME_MAX}
                placeholder={t('login.namePlaceholder')}
                onChange={(e) => {
                  setNewName(e.target.value)
                  setCreateError('')
                }}
                className={`${fieldClass} w-full text-[15px]`}
              />
              <div className="mt-[18px] flex items-center justify-between gap-4">
                <div>
                  <div className="text-[14px]">{t('login.usePin')}</div>
                  <div className="mt-0.5 text-[12.5px] text-[#8a8a8e]">{t('login.usePinHint')}</div>
                </div>
                <button
                  type="button"
                  role="switch"
                  aria-checked={usePin}
                  aria-label={t('login.usePin')}
                  onClick={() => {
                    setUsePin((v) => !v)
                    setCreateError('')
                  }}
                  className="flex h-6 w-10 shrink-0 cursor-pointer rounded-full p-[3px] transition-[background] duration-200"
                  style={{ justifyContent: usePin ? 'flex-end' : 'flex-start', background: usePin ? '#2d4fe6' : '#3a3a3d' }}
                >
                  <span className="h-[18px] w-[18px] rounded-full bg-[#f5f5f4]" />
                </button>
              </div>
              {usePin && (
                <input
                  value={newPin}
                  inputMode="numeric"
                  autoComplete="off"
                  maxLength={4}
                  placeholder="0000"
                  aria-label="PIN"
                  onChange={(e) => {
                    setNewPin(e.target.value.replace(/\D/g, '').slice(0, 4))
                    setCreateError('')
                  }}
                  className={`${fieldClass} mt-3 w-[140px] font-mono text-[18px] tracking-[.4em]`}
                />
              )}
              <div className="mt-3 h-5 text-[13px]" style={{ color: ERROR }}>
                {createError}
              </div>
              <div className="mt-3 flex gap-2.5">
                <button
                  type="button"
                  onClick={() => setStep('pick')}
                  className="flex h-[46px] cursor-pointer items-center rounded-full px-5 text-[14.5px] whitespace-nowrap text-[#c9c9c6] transition-colors hover:bg-[rgba(245,245,244,.08)] hover:text-[#f5f5f4]"
                >
                  {t('login.back')}
                </button>
                <button
                  type="submit"
                  className="flex h-[46px] cursor-pointer items-center rounded-full px-[22px] text-[14.5px] font-medium whitespace-nowrap"
                  style={{ background: canCreate ? INK : '#2a2a2d', color: canCreate ? '#141416' : '#6a6a6e' }}
                >
                  {t('login.create')}
                </button>
              </div>
            </form>
          )}

          {step === 'enter' && cur && (
            <div className="flex flex-col items-center gap-[22px]">
              <ProfileAvatar profile={cur} size={96} fontSize={30} />
              <div className="text-[22px] font-medium">{t('login.hello', { name: cur.name.split(' ')[0] })}</div>
              <div className="h-1 w-[200px] overflow-hidden rounded bg-[rgba(245,245,244,.14)]">
                <div
                  className="h-full bg-[linear-gradient(90deg,#2d4fe6,#6eb2f2_55%,#f2c54b)] transition-[width] duration-[680ms] ease-linear"
                  style={{ width: filled ? '100%' : '0%' }}
                />
              </div>
            </div>
          )}
        </div>

        <footer className="relative flex flex-wrap justify-center gap-5 px-6 pb-7 text-[12.5px] text-[#8a8a8e]">
          <button type="button" className="cursor-pointer transition-colors hover:text-[#f5f5f4]" onClick={() => void importProfile()}>
            {t('login.import')}
          </button>
          {info && <span>v{info.version}</span>}
        </footer>

        {toast && (
          <div
            role="status"
            className="absolute bottom-[72px] left-1/2 -translate-x-1/2 rounded-xl border border-[#2c2c30] bg-[#1f1f22] px-[18px] py-3 text-[13.5px] whitespace-nowrap shadow-[0_12px_30px_rgba(0,0,0,.4)]"
          >
            {toast}
          </div>
        )}
      </div>
    </div>
  )
}
