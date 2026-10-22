import { LOGO_PATHS, LOGO_VIEWBOX, SYMBOL_PATH, SYMBOL_VIEWBOX } from '../../../shared/brand'

/** Símbolo do Relaunch na cor do texto. */
export function LogoMark({ size = 30, className = 'text-primary' }: { size?: number; className?: string }) {
  return (
    <svg width={size} height={size} viewBox={SYMBOL_VIEWBOX} fill="currentColor" className={`shrink-0 ${className}`} aria-hidden>
      <path d={SYMBOL_PATH} />
    </svg>
  )
}

/** Logo completo (símbolo + "relaunch") na cor do texto; a largura acompanha a altura. */
export function Logo({ height = 22, className = 'text-primary', title = 'Relaunch' }: { height?: number; className?: string; title?: string }) {
  return (
    <svg height={height} viewBox={LOGO_VIEWBOX} fill="currentColor" className={`shrink-0 ${className}`} role="img" aria-label={title}>
      {LOGO_PATHS.map((d, i) => (
        <path key={i} d={d} />
      ))}
    </svg>
  )
}
