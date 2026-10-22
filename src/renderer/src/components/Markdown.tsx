import { lazy, Suspense } from 'react'

// O parser de markdown (~150 KB) só carrega quando algum texto aparece, fora da abertura do app.
const MarkdownView = lazy(() => import('./MarkdownView'))

/** Markdown seguro (sem HTML bruto); links abrem no navegador externo. */
export function Markdown(props: { children: string; className?: string }) {
  return (
    <Suspense fallback={null}>
      <MarkdownView {...props} />
    </Suspense>
  )
}
