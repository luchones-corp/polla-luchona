import { useEffect, useState } from 'react'
import { formatCountdown } from '../lib/countdown'

export function useCountdown(kickoffIso: string): string | null {
  const [label, setLabel] = useState(() => formatCountdown(kickoffIso))

  useEffect(() => {
    const diff = new Date(kickoffIso).getTime() - Date.now()
    if (diff <= 0) {
      setLabel(null)
      return
    }

    const interval = diff < 5 * 60_000 ? 1_000 : 60_000
    const timer = window.setInterval(() => {
      setLabel(formatCountdown(kickoffIso))
    }, interval)

    return () => window.clearInterval(timer)
  }, [kickoffIso])

  return label
}
