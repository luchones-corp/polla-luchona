import { FormEvent, useCallback, useEffect, useRef, useState } from 'react'
import { getGroupMessages, sendGroupMessage, type GroupMessage } from '../lib/api'
import { useRealtimeMessages } from '../hooks/useRealtimeMessages'
import { useLocale } from '../contexts/LocaleContext'
import { Avatar } from './Avatar'

function formatTime(iso: string): string {
  return new Intl.DateTimeFormat(undefined, { hour: '2-digit', minute: '2-digit' }).format(new Date(iso))
}

export function GroupChat({ groupId, userId }: { groupId: string; userId: string }) {
  const { t } = useLocale()
  const [messages, setMessages] = useState<GroupMessage[]>([])
  const [body, setBody] = useState('')
  const [sending, setSending] = useState(false)
  const scrollRef = useRef<HTMLDivElement>(null)

  const loadMessages = useCallback(() => {
    getGroupMessages(groupId).then(setMessages).catch(() => {})
  }, [groupId])

  useEffect(() => {
    loadMessages()
  }, [loadMessages])

  useRealtimeMessages(groupId, loadMessages)

  useEffect(() => {
    const el = scrollRef.current
    if (el) el.scrollTop = el.scrollHeight
  }, [messages])

  async function handleSend(e: FormEvent) {
    e.preventDefault()
    const trimmed = body.trim()
    if (!trimmed || sending) return

    const optimistic: GroupMessage = {
      id: `local-${Date.now()}`,
      group_id: groupId,
      user_id: userId,
      display_name: null,
      body: trimmed,
      created_at: new Date().toISOString(),
    }
    setMessages(prev => [...prev, optimistic])
    setBody('')
    setSending(true)

    try {
      await sendGroupMessage(groupId, userId, trimmed)
      loadMessages()
    } catch {
      setMessages(prev => prev.filter(m => m.id !== optimistic.id))
    } finally {
      setSending(false)
    }
  }

  return (
    <div className="chat-panel card">
      <div className="sec-head" style={{ margin: '0 0 8px', padding: '16px 16px 0' }}>
        <h2 style={{ fontSize: 20 }}>{t('chat.heading')}</h2>
        <span className="sub">{messages.length} {t('chat.messages')}</span>
      </div>

      <div className="chat-messages" ref={scrollRef}>
        {messages.length === 0 && (
          <p style={{ color: 'var(--ink-3)', textAlign: 'center', padding: '24px 16px', fontSize: 13 }}>
            {t('chat.empty')}
          </p>
        )}
        {messages.map(m => {
          const isMe = m.user_id === userId
          return (
            <div key={m.id} className={'chat-bubble-wrap' + (isMe ? ' me' : '')}>
              {!isMe && <Avatar name={m.display_name ?? '?'} size={28} />}
              <div className={'chat-bubble' + (isMe ? ' me' : '')}>
                {!isMe && <div className="chat-name">{m.display_name ?? t('chat.noName')}</div>}
                <div className="chat-body">{m.body}</div>
                <div className="chat-time">{formatTime(m.created_at)}</div>
              </div>
            </div>
          )
        })}
      </div>

      <form className="chat-input-row" onSubmit={handleSend}>
        <input
          value={body}
          onChange={e => setBody(e.target.value)}
          placeholder={t('chat.placeholder')}
          maxLength={500}
        />
        <button className="btn btn-primary btn-sm" type="submit" disabled={!body.trim() || sending}>
          {t('chat.send')}
        </button>
      </form>
    </div>
  )
}
