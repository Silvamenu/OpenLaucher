import { LoaderCircle } from 'lucide-react'
import { DevlogModal } from './components/DevlogModal'
import { Sidebar } from './components/Sidebar'
import { Toasts } from './components/Toasts'
import { AddGamePage } from './pages/AddGamePage'
import { GamePage } from './pages/GamePage'
import { LibraryPage } from './pages/LibraryPage'
import { SettingsPage } from './pages/SettingsPage'
import { useAppState } from './state/AppState'

export default function App() {
  const { ready, route } = useAppState()
  return (
    <div className="flex h-full overflow-hidden">
      <Sidebar />
      <main id="main-scroll" className="min-w-0 flex-1 overflow-y-auto">
        {!ready ? (
          <div className="flex h-full items-center justify-center text-muted">
            <LoaderCircle className="animate-spin" />
          </div>
        ) : route.page === 'library' ? (
          <LibraryPage />
        ) : route.page === 'add' ? (
          <AddGamePage />
        ) : route.page === 'settings' ? (
          <SettingsPage />
        ) : (
          <GamePage key={route.id} id={route.id} tab={route.tab} />
        )}
      </main>
      <DevlogModal />
      <Toasts />
    </div>
  )
}
