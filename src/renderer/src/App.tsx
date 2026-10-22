import { LoaderCircle } from 'lucide-react'
import { useEffect } from 'react'
import { DevlogModal } from './components/DevlogModal'
import { Sidebar } from './components/Sidebar'
import { Toasts } from './components/Toasts'
import { useI18n } from './i18n'
import { errorMessage } from './lib/format'
import { AddGamePage } from './pages/AddGamePage'
import { DownloadsPage } from './pages/DownloadsPage'
import { GamePage } from './pages/GamePage'
import { LibraryPage } from './pages/LibraryPage'
import { LoginScreen } from './pages/LoginScreen'
import { SettingsPage } from './pages/SettingsPage'
import { useAppState } from './state/AppState'

/** Avisa o fim de uma instalação: se não terminar, o jogo sai da biblioteca e só a mensagem explica o porquê. */
function InstallNotices() {
  const { route, navigate, toast } = useAppState()
  const { t } = useI18n()
  useEffect(
    () =>
      window.api.on('game:progress', (p) => {
        if (p.kind !== 'install') return
        const name = p.name ?? ''
        if (p.stage === 'done') toast('success', t('install.done', { name }))
        if (p.stage === 'error') toast('error', t('install.failed', { name, error: p.error ? errorMessage(p.error, t) : '' }))
        if ((p.stage === 'error' || p.stage === 'cancelled') && route.page === 'game' && route.id === p.entryId) navigate({ page: 'add' })
      }),
    [route, navigate, toast, t]
  )
  return null
}

export default function App() {
  const { ready, route, profiles } = useAppState()
  if (!profiles) return <div className="h-full bg-[#141416]" />
  if (!profiles.current) return <LoginScreen />
  return (
    <div className="flex h-full min-h-[560px] overflow-hidden bg-app py-2 pr-2">
      <Sidebar />
      <main className="flex min-w-0 flex-1 flex-col overflow-hidden rounded-2xl border border-panel-line bg-panel">
        <div id="main-scroll" className="min-h-0 flex-1 overflow-y-auto">
          {!ready ? (
            <div className="flex h-full items-center justify-center text-subtle">
              <LoaderCircle className="animate-spin" />
            </div>
          ) : route.page === 'library' ? (
            <LibraryPage />
          ) : route.page === 'add' ? (
            <AddGamePage />
          ) : route.page === 'downloads' ? (
            <DownloadsPage />
          ) : route.page === 'settings' ? (
            <SettingsPage />
          ) : (
            <GamePage key={route.id} id={route.id} tab={route.tab} />
          )}
        </div>
      </main>
      <DevlogModal />
      <Toasts />
      <InstallNotices />
    </div>
  )
}
