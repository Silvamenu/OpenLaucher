import { Gamepad2, Plus, RefreshCw, Search, ShieldCheck } from 'lucide-react'
import { useMemo, useState } from 'react'
import { GameCard } from '../components/GameCard'
import { Button } from '../components/ui'
import { useI18n } from '../i18n'
import { errorMessage } from '../lib/format'
import { useAppState } from '../state/AppState'

type Filter = 'all' | 'ready' | 'setup' | 'updates'

export function LibraryPage() {
  const { items, navigate, toast, setItems } = useAppState()
  const { t } = useI18n()
  const [query, setQuery] = useState('')
  const [filter, setFilter] = useState<Filter>('all')
  const [checking, setChecking] = useState(false)

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase()
    return items.filter((item) => {
      if (q && !`${item.name} ${item.manifest?.originalGame ?? ''}`.toLowerCase().includes(q)) return false
      if (filter === 'ready') return item.status === 'ready'
      if (filter === 'setup') return item.status !== 'ready'
      if (filter === 'updates') return item.update.available
      return true
    })
  }, [items, query, filter])

  const checkUpdates = async () => {
    setChecking(true)
    try {
      setItems(await window.api.updates.check())
      const errors = (await window.api.library.list()).map((i) => i.update.error).filter(Boolean)
      if (errors[0]) toast('error', errorMessage(errors[0], t))
    } catch (err) {
      toast('error', errorMessage(err, t))
    } finally {
      setChecking(false)
    }
  }

  if (items.length === 0) {
    return (
      <div className="flex min-h-full flex-col items-center justify-center px-6 py-16 text-center">
        <div className="mb-5 flex h-20 w-20 items-center justify-center rounded-3xl bg-accent/12 text-accent">
          <Gamepad2 size={40} />
        </div>
        <h1 className="text-2xl font-bold tracking-tight">{t('library.empty.title')}</h1>
        <p className="mt-2 max-w-md text-sm text-muted">{t('library.empty.body')}</p>
        <Button variant="primary" size="lg" className="mt-6" icon={<Plus size={18} />} onClick={() => navigate({ page: 'add' })}>
          {t('nav.add')}
        </Button>
        <p className="mt-10 flex max-w-md items-start gap-2 text-left text-xs text-muted">
          <ShieldCheck size={16} className="mt-px shrink-0 text-emerald-500" />
          {t('legal.note')}
        </p>
      </div>
    )
  }

  const filters: { id: Filter; label: string }[] = [
    { id: 'all', label: t('library.filter.all') },
    { id: 'ready', label: t('library.filter.ready') },
    { id: 'setup', label: t('library.filter.setup') },
    { id: 'updates', label: t('library.filter.updates') }
  ]

  return (
    <div className="mx-auto max-w-[1600px] px-6 py-6 lg:px-8">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">{t('library.title')}</h1>
          <p className="text-sm text-muted">{items.length === 1 ? t('library.countOne') : t('library.count', { n: items.length })}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button icon={<RefreshCw size={15} className={checking ? 'animate-spin' : ''} />} onClick={checkUpdates} disabled={checking}>
            {checking ? t('library.checking') : t('library.checkUpdates')}
          </Button>
          <Button variant="primary" icon={<Plus size={16} />} onClick={() => navigate({ page: 'add' })}>
            {t('nav.add')}
          </Button>
        </div>
      </header>

      <div className="mt-5 flex flex-wrap items-center gap-3">
        <div className="relative w-full max-w-xs">
          <Search size={15} className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-muted" />
          <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder={t('library.search')} className="input w-full pl-9" />
        </div>
        <div className="flex flex-wrap gap-1 rounded-lg border border-line bg-card p-1">
          {filters.map((f) => (
            <button
              key={f.id}
              type="button"
              onClick={() => setFilter(f.id)}
              className={`rounded-md px-3 py-1 text-xs font-medium transition ${filter === f.id ? 'bg-accent text-white' : 'text-muted hover:text-fg'}`}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {visible.length === 0 ? (
        <p className="mt-16 text-center text-sm text-muted">{t('library.noResults')}</p>
      ) : (
        <div className="mt-6 grid grid-cols-[repeat(auto-fill,minmax(190px,1fr))] gap-5">
          {visible.map((item) => (
            <GameCard key={item.entry.id} item={item} />
          ))}
        </div>
      )}
    </div>
  )
}
