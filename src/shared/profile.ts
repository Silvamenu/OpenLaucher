/** Regras dos perfis locais, compartilhadas pela interface e pelo processo principal. */

export const PROFILE_NAME_MAX = 20
export const PIN_PATTERN = /^\d{4}$/

/** Fundos dos avatares; o perfil guarda o índice. O último (neutro) não aparece na escolha de cor. */
export const PROFILE_COLORS = [
  'linear-gradient(140deg,#2d4fe6,#6eb2f2 60%,#f2c54b)',
  'linear-gradient(140deg,#f2773a,#f2c54b)',
  'linear-gradient(140deg,#1e9a95,#6eb2f2)',
  'linear-gradient(140deg,#7a3ee6,#f2773a)',
  'linear-gradient(140deg,#3a3a3d,#6a6a6e)'
] as const

/** Iniciais do avatar: primeira letra das duas primeiras palavras ("André S." → "AS"). */
export function profileInitials(name: string): string {
  return (
    name
      .trim()
      .split(/\s+/)
      .slice(0, 2)
      .map((word) => word[0] ?? '')
      .join('')
      .toUpperCase() || '?'
  )
}
