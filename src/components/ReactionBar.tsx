import { useState } from 'react'
import { toggleReaction } from '../lib/api'
import type { ReactionSummary } from '../lib/types'

const EMOJI_MAP: Record<string, string> = {
  goal: '\u26BD',
  fire: '\uD83D\uDD25',
  cry: '\uD83D\uDE2D',
  laugh: '\uD83D\uDE02',
  shock: '\uD83D\uDE31',
  clap: '\uD83D\uDC4F',
}

const EMOJI_KEYS = Object.keys(EMOJI_MAP)

export function ReactionBar({ matchId, groupId, userId, reactions }: {
  matchId: number
  groupId: string
  userId: string
  reactions: ReactionSummary[]
}) {
  const [localReactions, setLocalReactions] = useState<ReactionSummary[]>(reactions)
  const [busy, setBusy] = useState<string | null>(null)

  async function handleToggle(emoji: string) {
    if (busy) return
    setBusy(emoji)

    // Optimistic update
    const existing = localReactions.find(r => r.emoji === emoji)
    const wasReacted = existing?.user_reacted ?? false
    setLocalReactions(prev => {
      if (wasReacted) {
        return prev.map(r => r.emoji === emoji
          ? { ...r, count: Math.max(0, r.count - 1), user_reacted: false }
          : r
        ).filter(r => r.count > 0 || EMOJI_KEYS.includes(r.emoji))
      } else {
        if (existing) {
          return prev.map(r => r.emoji === emoji
            ? { ...r, count: r.count + 1, user_reacted: true }
            : r
          )
        }
        return [...prev, { match_id: matchId, emoji, count: 1, user_reacted: true }]
      }
    })

    try {
      await toggleReaction(matchId, groupId, userId, emoji)
    } catch {
      // Revert on error
      setLocalReactions(reactions)
    } finally {
      setBusy(null)
    }
  }

  return (
    <div className="reaction-bar">
      {EMOJI_KEYS.map(emoji => {
        const r = localReactions.find(lr => lr.emoji === emoji)
        const count = r?.count ?? 0
        const reacted = r?.user_reacted ?? false
        return (
          <button
            key={emoji}
            className={'reaction-btn' + (reacted ? ' reacted' : '')}
            onClick={() => handleToggle(emoji)}
            disabled={busy !== null}
          >
            <span className="reaction-emoji">{EMOJI_MAP[emoji]}</span>
            {count > 0 && <span className="reaction-count">{count}</span>}
          </button>
        )
      })}
    </div>
  )
}
