import { useEffect } from 'react'
import { supabase } from '../lib/supabase'

export function useRealtimeMessages(groupId: string | null, onNewMessage: () => void) {
  useEffect(() => {
    if (!groupId) return

    const channel = supabase
      .channel(`group-messages-${groupId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'group_messages',
          filter: `group_id=eq.${groupId}`,
        },
        () => onNewMessage(),
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [groupId, onNewMessage])
}
