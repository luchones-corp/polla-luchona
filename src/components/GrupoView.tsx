import { useState } from 'react'
import type { Session } from '@supabase/supabase-js'
import { Avatar } from './Avatar'
import { GroupChat } from './GroupChat'
import { ICONS } from './Icons'
import { setGroupClosed, updateGroupLockMinutes, updateGroupName } from '../lib/api'
import { useLocale } from '../contexts/LocaleContext'
import type { Group, GroupMember } from '../lib/types'

export function GrupoView({ selectedGroup, isOwner, members, session, onRegenerateInvite, onRemoveMember, onLeaveGroup, onDeleteGroup, toast, onGroupUpdated }: {
  selectedGroup: Group | null
  isOwner: boolean
  members: GroupMember[]
  session: Session
  onRegenerateInvite: () => void
  onRemoveMember: (id: string) => void
  onLeaveGroup: () => void
  onDeleteGroup: () => void
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
          {selectedGroup.is_closed && (
            <p style={{ color: 'var(--ink-2)', fontSize: 13, marginTop: 6 }}>
              <span className="chip" style={{ marginRight: 6 }}>{t('grupo.closedTag')}</span>
              {t('grupo.closedDesc')}
            </p>
          )}
          <div className="share-row">
            <button
              className="btn btn-primary btn-sm"
              onClick={() => { navigator.clipboard.writeText(inviteLink); toast(t('grupo.linkCopied')) }}
              disabled={selectedGroup.is_closed}
              title={selectedGroup.is_closed ? t('grupo.closedDesc') : undefined}
            >
              {ICONS.copy} {t('grupo.copyLink')}
            </button>
            {isOwner && (
              <button className="btn btn-dark btn-sm" onClick={onRegenerateInvite} disabled={selectedGroup.is_closed}>
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
          {!isOwner && (
            <button className="btn btn-danger btn-sm" style={{ marginTop: 16, width: '100%' }} onClick={onLeaveGroup}>
              {t('grupo.leave')}
            </button>
          )}
        </div>
      </div>

      {isOwner && (
        <div className="card group-settings" style={{ padding: '18px 20px', marginTop: 20 }}>
          <h3 style={{ fontSize: 16, fontFamily: 'var(--font-head)', fontWeight: 800, marginBottom: 12 }}>{t('grupo.settings')}</h3>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap', marginBottom: 14 }}>
            <label style={{ fontSize: 13, color: 'var(--ink-2)', fontWeight: 600 }}>{t('grupo.nameLabel')}</label>
            <input
              key={selectedGroup.id}
              defaultValue={selectedGroup.name}
              onBlur={async (e) => {
                const val = e.target.value.trim()
                if (!val || val === selectedGroup.name) { e.target.value = selectedGroup.name; return }
                try {
                  await updateGroupName(selectedGroup.id, val)
                  toast(t('grupo.settingsUpdated'))
                  onGroupUpdated?.()
                } catch {
                  e.target.value = selectedGroup.name
                  toast(t('grupo.settingsError'))
                }
              }}
              onKeyDown={(e) => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur() }}
              style={{
                padding: '6px 12px', borderRadius: 8, border: '1px solid var(--line-2)',
                background: 'var(--surface-2)', color: 'var(--ink)', fontSize: 13,
                fontFamily: 'var(--font-body)', flex: 1, minWidth: 140,
              }}
            />
          </div>
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
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', marginTop: 14 }}>
            <div>
              <div style={{ fontSize: 13, color: 'var(--ink-2)', fontWeight: 600 }}>
                {selectedGroup.is_closed ? t('grupo.closedLabel') : t('grupo.openLabel')}
              </div>
              <div style={{ fontSize: 12, color: 'var(--ink-3)', marginTop: 2 }}>
                {selectedGroup.is_closed ? t('grupo.closedDesc') : t('grupo.openDesc')}
              </div>
            </div>
            <button
              className={'btn btn-sm ' + (selectedGroup.is_closed ? 'btn-primary' : 'btn-dark')}
              onClick={async () => {
                try {
                  await setGroupClosed(selectedGroup.id, !selectedGroup.is_closed)
                  toast(selectedGroup.is_closed ? t('grupo.reopened') : t('grupo.closed'))
                  onGroupUpdated?.()
                } catch {
                  toast(t('grupo.settingsError'))
                }
              }}
            >
              {selectedGroup.is_closed ? t('grupo.reopenBtn') : t('grupo.closeBtn')}
            </button>
          </div>
          {members.length === 1 && (
            <button className="btn btn-danger btn-sm" style={{ marginTop: 16, width: '100%' }} onClick={onDeleteGroup}>
              {t('grupo.delete')}
            </button>
          )}
        </div>
      )}

      <GroupChat groupId={selectedGroup.id} userId={session.user.id} />
    </div>
  )
}
