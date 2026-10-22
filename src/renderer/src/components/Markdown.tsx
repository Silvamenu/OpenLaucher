import { lazy, Suspense } from 'react'

// O parser de markdown (~150 KB) só carrega quando algum texto aparece, fora da abertura do app.
const MarkdownView = lazy(() => import('./MarkdownView'))

/** Markdown seguro (sem HTML bruto); links abrem no navegador externo. `glossary` marca os termos técnicos com dicas. */
export function Markdown(props: { children: string; className?: string; glossary?: boolean }) {
  return (
    <Suspense fallback={null}>
      <MarkdownView {...props} />
    </Suspense>
  )
}
