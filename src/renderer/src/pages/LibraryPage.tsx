import { Plus, RefreshCw, ShieldCheck } from 'lucide-react'
import { useMemo, useState } from 'react'
import { GameCard } from '../components/GameCard'
import { LogoMark } from '../components/icons'
import { Button, Chip, Page, PageHeader } from '../components/ui'
import { useI18n } from '../i18n'
import { errorMessage } from '../lib/format'
import { useAppState } from '../state/AppState'

type Filter = 'all' | 'ready' | 'setup' | 'updates'

export function LibraryPage() {
  const { items, navigate, toast, setItems, query } = useAppState()
  const { t } = useI18n()
  const [filter, setFilter] = useState<Filter>('all')
  const [checking, setChecking] = useState(false)

  const counts = {
    all: items.length,
    ready: items.filter((i) => i.status === 'ready').length,
    setup: items.filter((i) => i.status !== 'ready').length,
    updates: items.filter((i) => i.update.available).length
  }

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
      const list = await window.api.updates.check()
      setItems(list)
      const error = list.map((i) => i.update.error).find(Boolean)
      if (error) toast('error', errorMessage(error, t))
    } catch (err) {
      toast('error', errorMessage(err, t))
    } finally {
      setChecking(false)
    }
  }

  if (items.length === 0) {
    return (
      <div className="flex min-h-full flex-col items-center justify-center px-6 py-16 text-center">
        <LogoMark size={48} />
        <h1 className="mt-6 text-[24px] font-semibold tracking-[-0.025em]">{t('library.empty.title')}</h1>
        <p className="mt-2 max-w-md text-[13.5px] leading-relaxed text-subtle">{t('library.empty.body')}</p>
        <Button variant="primary" className="mt-7" icon={<Plus size={16} />} onClick={() => navigate({ page: 'add' })}>
          {t('nav.add')}
        </Button>
        <p className="mt-12 flex max-w-md items-start gap-2 text-left text-[12px] text-faint">
          <ShieldCheck size={15} className="mt-px shrink-0" />
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
    <Page>
      <PageHeader
        title={t('library.title')}
        subtitle={items.length === 1 ? t('library.countOne') : t('library.count', { n: items.length })}
        actions={
          <>
            <Button icon={<RefreshCw size={14} className={checking ? 'animate-spin' : ''} />} onClick={checkUpdates} disabled={checking}>
              {checking ? t('library.checking') : t('library.checkUpdates')}
            </Button>
            <Button variant="primary" icon={<Plus size={15} />} onClick={() => navigate({ page: 'add' })}>
              {t('nav.add')}
            </Button>
          </>
        }
      />

      <div className="mb-6 flex flex-wrap gap-1.5">
        {filters.map((f) => (
          <Chip key={f.id} active={filter === f.id} count={counts[f.id]} onClick={() => setFilter(f.id)}>
            {f.label}
          </Chip>
        ))}
      </div>

      {visible.length === 0 ? (
        <p className="mt-16 text-center text-[13px] text-subtle">{query ? t('library.noResultsQuery', { query }) : t('library.noResults')}</p>
      ) : (
        <div className="grid grid-cols-[repeat(auto-fill,minmax(200px,1fr))] gap-4">
          {visible.map((item) => (
            <GameCard key={item.entry.id} item={item} />
          ))}
        </div>
      )}
    </Page>
  )
}
