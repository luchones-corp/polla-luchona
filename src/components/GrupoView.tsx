import type { Session } from '@supabase/supabase-js'
import { Avatar } from './Avatar'
import { GroupChat } from './GroupChat'
import { ICONS } from './Icons'
import type { Group, GroupMember } from '../lib/types'

export function GrupoView({ selectedGroup, isOwner, members, session, onRegenerateInvite, onRemoveMember, toast }: {
  selectedGroup: Group | null
  isOwner: boolean
  members: GroupMember[]
  session: Session
  onRegenerateInvite: () => void
  onRemoveMember: (id: string) => void
  toast: (msg: string) => void
}) {
  if (!selectedGroup) {
    return (
      <div className="wrap fade-in">
        <div className="sec-head"><h2>Tu grupo</h2></div>
        <div className="card" style={{ padding: 24 }}>
          <p style={{ color: 'var(--ink-2)' }}>No perteneces a ningún grupo aún.</p>
        </div>
      </div>
    )
  }

  const inviteLink = `${window.location.origin}/join/${selectedGroup.invite_token}`

  return (
    <div className="wrap fade-in">
      <div className="sec-head">
        <div>
          <p className="kicker" style={{ marginBottom: 6 }}>Administración</p>
          <h2>Tu grupo</h2>
        </div>
        <span className="chip chip-lime">{members.length} jugadores</span>
      </div>

      <div className="grp-grid">
        <div className="invite-card card">
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
            <div style={{
              width: 44, height: 44, borderRadius: 11, background: 'var(--lime)',
              color: '#0a0d10', display: 'grid', placeItems: 'center',
              fontFamily: 'var(--font-disp)', fontSize: 18, transform: 'skewX(-6deg)', flexShrink: 0,
            }}>
              <span style={{ transform: 'skewX(6deg)' }}>🏆</span>
            </div>
            <div>
              <h3>{selectedGroup.name}</h3>
              <div style={{ color: 'var(--ink-3)', fontSize: 12, fontWeight: 600 }}>Mundial 2026</div>
            </div>
          </div>
          <p>Comparte este enlace y cualquiera podrá unirse a competir en tu polla.</p>
          <div className="share-row">
            <button className="btn btn-primary btn-sm" onClick={() => { navigator.clipboard.writeText(inviteLink); toast('¡Enlace copiado!') }}>
              {ICONS.copy} Copiar enlace
            </button>
            {isOwner && (
              <button className="btn btn-dark btn-sm" onClick={onRegenerateInvite}>
                {ICONS.regen} Regenerar
              </button>
            )}
          </div>
        </div>

        <div className="card" style={{ padding: '6px 18px 14px' }}>
          <div className="sec-head" style={{ margin: '16px 0 4px' }}>
            <h2 style={{ fontSize: 20 }}>Miembros</h2>
            <span className="sub">{members.length} jugadores</span>
          </div>
          <div className="member-list">
            {members.map(m => (
              <div className="member-row" key={m.user_id}>
                <Avatar name={m.display_name ?? '?'} size={42} />
                <div style={{ minWidth: 0 }}>
                  <div className="mn">
                    {m.display_name ?? 'Sin nombre'}
                    {m.user_id === selectedGroup.owner_id && <span className="admin-tag">Admin</span>}
                    {m.user_id === session.user.id && <span className="you-tag">TÚ</span>}
                  </div>
                </div>
                <div className="mright">
                  {isOwner && m.user_id !== session.user.id && (
                    <button className="btn btn-danger btn-sm" onClick={() => onRemoveMember(m.user_id)}>Quitar</button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <GroupChat groupId={selectedGroup.id} userId={session.user.id} />
    </div>
  )
}
