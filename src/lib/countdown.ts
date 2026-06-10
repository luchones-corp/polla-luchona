export function formatCountdown(kickoffIso: string): string | null {
  const diff = new Date(kickoffIso).getTime() - Date.now()
  if (diff <= 0) return null

  const mins = Math.floor(diff / 60_000)
  const hours = Math.floor(mins / 60)
  const days = Math.floor(hours / 24)

  if (days > 0) return `Cierra en ${days}d ${hours % 24}h`
  if (hours > 0) return `Cierra en ${hours}h ${mins % 60}m`
  return `Cierra en ${mins}m`
}
