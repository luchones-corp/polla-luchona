import { useMemo } from 'react'
import { computeAchievements, type Achievement } from '../lib/achievements'
import type { Fixture, Prediction } from '../lib/types'

function AchievementCard({ a }: { a: Achievement }) {
  return (
    <div className={'ach-card' + (a.earned ? ' earned' : '')}>
      <div className="ach-icon">{a.icon}</div>
      <div className="ach-info">
        <div className="ach-name">{a.name}</div>
        <div className="ach-desc">{a.description}</div>
        {a.progress && (
          <div className="ach-progress">
            <div className="ach-bar">
              <div className="ach-fill" style={{ width: `${Math.min((a.progress.current / a.progress.target) * 100, 100)}%` }} />
            </div>
            <span className="ach-count">{a.progress.current}/{a.progress.target}</span>
          </div>
        )}
      </div>
    </div>
  )
}

export function AchievementsPanel({ fixtures, predictionsByMatch, onClose }: {
  fixtures: Fixture[]
  predictionsByMatch: Record<number, Prediction>
  onClose: () => void
}) {
  const achievements = useMemo(() => computeAchievements(fixtures, predictionsByMatch), [fixtures, predictionsByMatch])
  const earned = achievements.filter(a => a.earned).length

  return (
    <div className="h2h-overlay" onClick={onClose}>
      <div className="card h2h-panel" onClick={e => e.stopPropagation()}>
        <button className="btn btn-ghost btn-sm" onClick={onClose} style={{ position: 'absolute', top: 14, right: 14 }}>✕</button>
        <h2 style={{ fontFamily: 'var(--font-disp)', fontSize: 22, textTransform: 'uppercase', marginBottom: 4 }}>Logros</h2>
        <p style={{ color: 'var(--ink-3)', fontSize: 13, marginBottom: 18 }}>{earned} de {achievements.length} desbloqueados</p>
        <div className="ach-grid">
          {achievements.map(a => <AchievementCard key={a.id} a={a} />)}
        </div>
      </div>
    </div>
  )
}
