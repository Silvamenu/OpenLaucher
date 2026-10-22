import type { CSSProperties } from 'react'
import { PROFILE_COLORS, profileInitials } from '../../../shared/profile'

/** Avatar do perfil: iniciais sobre o degradê escolhido. */
export function ProfileAvatar({
  profile,
  size,
  fontSize = Math.round(size * 0.36),
  ring = false
}: {
  profile: { name: string; color: number }
  size: number
  fontSize?: number
  ring?: boolean
}) {
  const style: CSSProperties = { width: size, height: size, fontSize, background: PROFILE_COLORS[profile.color] ?? PROFILE_COLORS[0] }
  if (ring) style.boxShadow = '0 0 0 1px rgba(245,245,244,.12)'
  return (
    <span className="grid shrink-0 place-items-center rounded-full font-semibold text-[#f5f5f4]" style={style}>
      {profileInitials(profile.name)}
    </span>
  )
}
