import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import type { MatchEvent } from '../lib/types'

export function useRealtimeMatchEvents(initialEvents: MatchEvent[]) {
  const [events, setEvents] = useState(initialEvents)

  useEffect(() => {
    setEvents(initialEvents)
  }, [initialEvents])

  useEffect(() => {
    const channel = supabase
      .channel('match-events-realtime')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'match_events' },
        (payload) => {
          const newEvent = payload.new as MatchEvent
          setEvents(prev => [newEvent, ...prev])
        },
      )
      .subscribe()

    return () => { void supabase.removeChannel(channel) }
  }, [])

  return events
}
