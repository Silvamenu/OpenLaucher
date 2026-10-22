import { LoaderCircle } from 'lucide-react'
import { DevlogModal } from './components/DevlogModal'
import { Sidebar } from './components/Sidebar'
import { Toasts } from './components/Toasts'
import { AddGamePage } from './pages/AddGamePage'
import { DownloadsPage } from './pages/DownloadsPage'
import { GamePage } from './pages/GamePage'
import { LibraryPage } from './pages/LibraryPage'
import { SettingsPage } from './pages/SettingsPage'
import { useAppState } from './state/AppState'

export default function App() {
  const { ready, route } = useAppState()
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
    </div>
  )
}
