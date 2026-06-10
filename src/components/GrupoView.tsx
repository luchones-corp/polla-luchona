import type { Session } from '@supabase/supabase-js'
import { Avatar } from './Avatar'
import { GroupChat } from './GroupChat'
import { ICONS } from './Icons'
import { updateGroupLockMinutes } from '../lib/api'
import { useLocale } from '../contexts/LocaleContext'
import type { Group, GroupMember } from '../lib/types'

export function GrupoView({ selectedGroup, isOwner, members, session, onRegenerateInvite, onRemoveMember, toast, onGroupUpdated }: {
  selectedGroup: Group | null
  isOwner: boolean
  members: GroupMember[]
  session: Session
  onRegenerateInvite: () => void
  onRemoveMember: (id: string) => void
  toast: (msg: string) => void
  onGroupUpdated?: () => void
}) {
  const { t } = useLocale()

  const lockOptions = [
    { value: 0, label: t('grupo.lockAtStart') },
    { value: 15, label: t('grupo.lock15') },
    { value: 30, label: t('grupo.lock30') },
    { value: 60, label: t('grupo.lock60') },
  ]

  if (!selectedGroup) {
    return (
      <div className="wrap fade-in">
        <div className="sec-head"><h2>{t('grupo.heading')}</h2></div>
        <div className="card" style={{ padding: 24 }}>
          <p style={{ color: 'var(--ink-2)' }}>{t('grupo.noGroup')}</p>
        </div>
      </div>
    )
  }

  const inviteLink = `${window.location.origin}/join/${selectedGroup.invite_token}`

  return (
    <div className="wrap fade-in">
      <div className="sec-head">
        <div>
          <p className="kicker" style={{ marginBottom: 6 }}>{t('grupo.admin')}</p>
          <h2>{t('grupo.heading')}</h2>
        </div>
        <span className="chip chip-lime">{members.length} {t('tabla.players')}</span>
      </div>

      <div className="grp-grid">
        <div className="invite-card card">
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
            <div style={{
              width: 44, height: 44, borderRadius: 11, background: 'var(--lime)',
              color: '#0a0d10', display: 'grid', placeItems: 'center',
              fontFamily: 'var(--font-disp)', fontSize: 18, transform: 'skewX(-6deg)', flexShrink: 0,
            }}>
              <span style={{ transform: 'skewX(6deg)' }}>{'\uD83C\uDFC6'}</span>
            </div>
            <div>
              <h3>{selectedGroup.name}</h3>
              <div style={{ color: 'var(--ink-3)', fontSize: 12, fontWeight: 600 }}>{t('brand.subtitle')}</div>
            </div>
          </div>
          <p>{t('grupo.shareDesc')}</p>
          <div className="share-row">
            <button className="btn btn-primary btn-sm" onClick={() => { navigator.clipboard.writeText(inviteLink); toast(t('grupo.linkCopied')) }}>
              {ICONS.copy} {t('grupo.copyLink')}
            </button>
            {isOwner && (
              <button className="btn btn-dark btn-sm" onClick={onRegenerateInvite}>
                {ICONS.regen} {t('grupo.regenerate')}
              </button>
            )}
          </div>
        </div>

        <div className="card" style={{ padding: '6px 18px 14px' }}>
          <div className="sec-head" style={{ margin: '16px 0 4px' }}>
            <h2 style={{ fontSize: 20 }}>{t('grupo.members')}</h2>
            <span className="sub">{members.length} {t('tabla.players')}</span>
          </div>
          <div className="member-list">
            {members.map(m => (
              <div className="member-row" key={m.user_id}>
                <Avatar name={m.display_name ?? '?'} size={42} />
                <div style={{ minWidth: 0 }}>
                  <div className="mn">
                    {m.display_name ?? t('common.noName')}
                    {m.user_id === selectedGroup.owner_id && <span className="admin-tag">{t('grupo.adminTag')}</span>}
                    {m.user_id === session.user.id && <span className="you-tag">{t('grupo.youTag')}</span>}
                  </div>
                </div>
                <div className="mright">
                  {isOwner && m.user_id !== session.user.id && (
                    <button className="btn btn-danger btn-sm" onClick={() => onRemoveMember(m.user_id)}>{t('grupo.remove')}</button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {isOwner && (
        <div className="card group-settings" style={{ padding: '18px 20px', marginTop: 20 }}>
          <h3 style={{ fontSize: 16, fontFamily: 'var(--font-head)', fontWeight: 800, marginBottom: 12 }}>{t('grupo.settings')}</h3>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
            <label style={{ fontSize: 13, color: 'var(--ink-2)', fontWeight: 600 }}>{t('grupo.lockLabel')}</label>
            <select
              value={selectedGroup.lock_minutes_before}
              onChange={async (e) => {
                const val = Number(e.target.value)
                try {
                  await updateGroupLockMinutes(selectedGroup.id, val)
                  toast(t('grupo.settingsUpdated'))
                  onGroupUpdated?.()
                } catch {
                  toast(t('grupo.settingsError'))
                }
              }}
              style={{
                padding: '6px 12px', borderRadius: 8, border: '1px solid var(--line-2)',
                background: 'var(--surface-2)', color: 'var(--ink)', fontSize: 13,
                fontFamily: 'var(--font-body)',
              }}
            >
              {lockOptions.map(o => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
          </div>
          {/* Bot, archive, and view-archive buttons are hidden until migrations 011 are run */}
        </div>
      )}

      <GroupChat groupId={selectedGroup.id} userId={session.user.id} />
    </div>
  )
}
