export function formatLocalKickoff(iso: string): string {
  const date = new Date(iso)
  return new Intl.DateTimeFormat(undefined, {
    year: 'numeric',
    month: 'short',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date)
}

export function isBeforeKickoff(iso: string): boolean {
  return new Date(iso).getTime() > Date.now()
}

export function isBeforeLockTime(kickoffIso: string, lockMinutesBefore = 0): boolean {
  const lockTime = new Date(kickoffIso).getTime() - lockMinutesBefore * 60_000
  return lockTime > Date.now()
}

export function isToday(iso: string): boolean {
  const d = new Date(iso)
  const now = new Date()
  return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth() && d.getDate() === now.getDate()
}

export function isTomorrow(iso: string): boolean {
  const d = new Date(iso)
  const tom = new Date()
  tom.setDate(tom.getDate() + 1)
  return d.getFullYear() === tom.getFullYear() && d.getMonth() === tom.getMonth() && d.getDate() === tom.getDate()
}
