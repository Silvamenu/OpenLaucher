import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import type {
  AppInfo,
  AppUpdateState,
  DevlogView,
  LibraryItem,
  ManifestsReport,
  SettingsPatch,
  SettingsView,
  UpdateProgress
} from '../../../shared/types'
import { I18nProvider } from '../i18n'

export type Route = { page: 'library' } | { page: 'add' } | { page: 'downloads' } | { page: 'settings' } | { page: 'game'; id: string; tab?: GameTab }
export type GameTab = 'setup' | 'configs' | 'updates' | 'about'

export interface Toast {
  id: number
  kind: 'success' | 'error' | 'info'
  message: string
}

/** Operações de atualização/rollback concluídas nesta sessão (página Downloads). */
export interface HistoryItem {
  entryId: string
  kind: UpdateProgress['kind']
  stage: UpdateProgress['stage']
  version?: string
  error?: UpdateProgress['error']
  at: number
}

interface DevlogState {
  view: DevlogView
  /** Aberto automaticamente após atualizar: fechar marca a versão como vista. */
  markOnClose: boolean
}

interface AppStateValue {
  ready: boolean
  info: AppInfo | null
  settings: SettingsView | null
  items: LibraryItem[]
  manifests: ManifestsReport
  appUpdate: AppUpdateState
  progress: Record<string, UpdateProgress>
  history: HistoryItem[]
  query: string
  setQuery: (query: string) => void
  route: Route
  navigate: (route: Route) => void
  refresh: () => Promise<void>
  setItems: (items: LibraryItem[]) => void
  updateSettings: (patch: SettingsPatch) => Promise<void>
  setManifests: (report: ManifestsReport) => void
  toasts: Toast[]
  toast: (kind: Toast['kind'], message: string) => void
  dismissToast: (id: number) => void
  devlog: DevlogState | null
  openDevlog: (view: DevlogView, markOnClose?: boolean) => void
  closeDevlog: () => void
}

const AppStateContext = createContext<AppStateValue | null>(null)

function applyTheme(theme: SettingsView['theme']): () => void {
  const media = window.matchMedia('(prefers-color-scheme: dark)')
  const apply = () => {
    const dark = theme === 'dark' || (theme === 'system' && media.matches)
    document.documentElement.classList.toggle('dark', dark)
  }
  apply()
  if (theme !== 'system') return () => undefined
  media.addEventListener('change', apply)
  return () => media.removeEventListener('change', apply)
}

export function AppStateProvider({ children }: { children: ReactNode }) {
  const [ready, setReady] = useState(false)
  const [info, setInfo] = useState<AppInfo | null>(null)
  const [settings, setSettings] = useState<SettingsView | null>(null)
  const [items, setItems] = useState<LibraryItem[]>([])
  const [manifests, setManifests] = useState<ManifestsReport>({ manifests: [], errors: [] })
  const [appUpdate, setAppUpdate] = useState<AppUpdateState>({ status: 'idle' })
  const [progress, setProgress] = useState<Record<string, UpdateProgress>>({})
  const [history, setHistory] = useState<HistoryItem[]>([])
  const [query, setQuery] = useState('')
  const [route, setRoute] = useState<Route>({ page: 'library' })
  const [toasts, setToasts] = useState<Toast[]>([])
  const [devlog, setDevlog] = useState<DevlogState | null>(null)
  const toastId = useRef(0)

  const toast = useCallback((kind: Toast['kind'], message: string) => {
    const id = ++toastId.current
    setToasts((list) => [...list.slice(-3), { id, kind, message }])
    setTimeout(() => setToasts((list) => list.filter((t) => t.id !== id)), kind === 'error' ? 8000 : 4000)
  }, [])

  const dismissToast = useCallback((id: number) => setToasts((list) => list.filter((t) => t.id !== id)), [])

  const refresh = useCallback(async () => {
    const [lib, man] = await Promise.all([window.api.library.list(), window.api.manifests.list()])
    setItems(lib)
    setManifests(man)
  }, [])

  const updateSettings = useCallback(async (patch: SettingsPatch) => {
    setSettings(await window.api.settings.set(patch))
  }, [])

  const navigate = useCallback((next: Route) => {
    setRoute(next)
    document.getElementById('main-scroll')?.scrollTo({ top: 0 })
  }, [])

  const openDevlog = useCallback((view: DevlogView, markOnClose = false) => setDevlog({ view, markOnClose }), [])
  const closeDevlog = useCallback(() => {
    void window.api.devlog.markSeen()
    setDevlog(null)
  }, [])

  // Carga inicial + eventos do processo principal
  useEffect(() => {
    let alive = true
    void (async () => {
      const [appInfo, view, update] = await Promise.all([window.api.app.info(), window.api.settings.get(), window.api.appUpdate.state()])
      if (!alive) return
      setInfo(appInfo)
      setSettings(view)
      setAppUpdate(update)
      await refresh()
      setReady(true)
      const pending = await window.api.devlog.pending()
      if (alive && pending) setDevlog({ view: pending, markOnClose: true })
    })()
    const offs = [
      window.api.on('library:changed', (list) => setItems(list)),
      window.api.on('appUpdate:state', (state) => setAppUpdate(state)),
      window.api.on('settings:changed', (view) => setSettings(view)),
      window.api.on('navigate:game', (id) => setRoute({ page: 'game', id, tab: 'updates' })),
      window.api.on('game:progress', (p) => {
        setProgress((all) => ({ ...all, [p.entryId]: p }))
        if (p.stage === 'done' || p.stage === 'cancelled' || p.stage === 'error') {
          setHistory((list) => [{ entryId: p.entryId, kind: p.kind, stage: p.stage, version: p.version, error: p.error, at: Date.now() }, ...list].slice(0, 20))
        }
        if (p.stage === 'done' || p.stage === 'cancelled') {
          setTimeout(() => setProgress((all) => (all[p.entryId] === p ? omit(all, p.entryId) : all)), 2500)
        }
      })
    ]
    return () => {
      alive = false
      offs.forEach((off) => off())
    }
  }, [refresh])

  useEffect(() => (settings ? applyTheme(settings.theme) : undefined), [settings?.theme])

  useEffect(() => {
    document.documentElement.lang = settings?.language ?? 'pt-BR'
  }, [settings?.language])

  const value = useMemo<AppStateValue>(
    () => ({
      ready,
      info,
      settings,
      items,
      manifests,
      appUpdate,
      progress,
      history,
      query,
      setQuery,
      route,
      navigate,
      refresh,
      setItems,
      updateSettings,
      setManifests,
      toasts,
      toast,
      dismissToast,
      devlog,
      openDevlog,
      closeDevlog
    }),
    [ready, info, settings, items, manifests, appUpdate, progress, history, query, route, navigate, refresh, updateSettings, toasts, toast, dismissToast, devlog, openDevlog, closeDevlog]
  )

  return (
    <AppStateContext.Provider value={value}>
      <I18nProvider language={settings?.language ?? 'pt-BR'}>{children}</I18nProvider>
    </AppStateContext.Provider>
  )
}

function omit<T>(obj: Record<string, T>, key: string): Record<string, T> {
  const copy = { ...obj }
  delete copy[key]
  return copy
}

export function useAppState(): AppStateValue {
  const value = useContext(AppStateContext)
  if (!value) throw new Error('useAppState fora do AppStateProvider')
  return value
}
