/**
 * Shown to a zone manager whose zone list has loaded empty: they can add no
 * building (the API asks for one of their zones) and see none yet — say why,
 * so an empty list doesn't read as lost data. Same words as My team.
 */
export function NoZonesNotice({ className = '' }) {
  return (
    <p className={`rounded-btn bg-warn-tint px-4 py-3 text-sm font-normal text-warn ${className}`}>
      No zones assigned yet — ask an admin to give you your zones.
    </p>
  )
}
