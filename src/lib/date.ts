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
