import { useMemo, useState } from 'react'
import { isBeforeKickoff, isToday, isTomorrow } from '../lib/date'
import { useLocale } from '../contexts/LocaleContext'
import { FixtureCard } from './FixtureCard'
import { PredictAllFlow } from './PredictAllFlow'
import type { Fixture, GroupPrediction, MatchPick, Prediction, ReactionSummary } from '../lib/types'

type StageFilter = 'todos' | 'group' | 'r32' | 'r16' | 'qf' | 'sf' | 'final'
type DateFilter = 'todos' | 'hoy' | 'mañana'
type StatusFilter = 'todos' | 'pendiente' | 'predicho'

export function PartidosView({ fixtures, predictionsByMatch, groupPredictionsByMatch, onPick, onScoreChange, groupId, userId, reactionsByMatch, lockMinutesBefore = 0 }: {
  fixtures: Fixture[]
  predictionsByMatch: Record<number, Prediction>
  groupPredictionsByMatch: Record<number, GroupPrediction[]>
  onPick: (matchId: number, pick: MatchPick) => void
  onScoreChange: (matchId: number, home: number | null, away: number | null) => void
  groupId?: string
  userId?: string
  reactionsByMatch?: Record<number, ReactionSummary[]>
  lockMinutesBefore?: number
}) {
  const { t } = useLocale()
  const [page, setPage] = useState(0)
  const [showPredictAll, setShowPredictAll] = useState(false)
  const [stageFilter, setStageFilter] = useState<StageFilter>('todos')
  const [dateFilter, setDateFilter] = useState<DateFilter>('todos')
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('todos')

  const stageOptions: { value: StageFilter; label: string }[] = [
    { value: 'todos', label: t('partidos.all') },
    { value: 'group', label: t('partidos.groups') },
    { value: 'r32', label: 'R32' },
    { value: 'r16', label: 'R16' },
    { value: 'qf', label: t('partidos.qf') },
    { value: 'sf', label: t('partidos.sf') },
    { value: 'final', label: t('partidos.final') },
  ]
  const dateOptions: { value: DateFilter; label: string }[] = [
    { value: 'todos', label: t('partidos.all') },
    { value: 'hoy', label: t('partidos.today') },
    { value: 'mañana', label: t('partidos.tomorrow') },
  ]
  const statusOptions: { value: StatusFilter; label: string }[] = [
    { value: 'todos', label: t('partidos.all') },
    { value: 'pendiente', label: t('partidos.unpredicted') },
    { value: 'predicho', label: t('partidos.predicted') },
  ]

  const filtered = useMemo(() => {
    return fixtures.filter(f => {
      if (stageFilter !== 'todos' && f.stage !== stageFilter) return false
      if (dateFilter === 'hoy' && !isToday(f.kickoff_at)) return false
      if (dateFilter === 'mañana' && !isTomorrow(f.kickoff_at)) return false
      if (statusFilter === 'pendiente' && (!isBeforeKickoff(f.kickoff_at) || !!predictionsByMatch[f.id])) return false
      if (statusFilter === 'predicho' && !predictionsByMatch[f.id]) return false
      return true
    })
  }, [fixtures, predictionsByMatch, stageFilter, dateFilter, statusFilter])

  const PER_PAGE = 10
  const totalPages = Math.max(1, Math.ceil(filtered.length / PER_PAGE))
  const safePage = Math.min(page, totalPages - 1)
  const paged = filtered.slice(safePage * PER_PAGE, (safePage + 1) * PER_PAGE)
  const pending = fixtures.filter(f => isBeforeKickoff(f.kickoff_at) && !predictionsByMatch[f.id]).length

  function changeFilter<T>(setter: (v: T) => void, value: T) {
    setter(value)
    setPage(0)
  }

  return (
    <div className="wrap fade-in">
      <div className="sec-head">
        <h2>{t('partidos.heading')}</h2>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {pending > 0 && <span className="chip chip-gold">{pending} {t('partidos.noPrediction')}</span>}
          {pending > 0 && (
            <button className="btn btn-primary btn-sm" onClick={() => setShowPredictAll(true)}>
              {t('partidos.predictAll')}
            </button>
          )}
        </div>
      </div>

      <div className="filter-bar">
        <div className="filter-group">
          {stageOptions.map(o => (
            <button key={o.value} className={'chip' + (stageFilter === o.value ? ' chip-lime' : '')} onClick={() => changeFilter(setStageFilter, o.value)}>{o.label}</button>
          ))}
        </div>
        <div className="filter-group">
          {dateOptions.map(o => (
            <button key={o.value} className={'chip' + (dateFilter === o.value ? ' chip-lime' : '')} onClick={() => changeFilter(setDateFilter, o.value)}>{o.label}</button>
          ))}
        </div>
        <div className="filter-group">
          {statusOptions.map(o => (
            <button key={o.value} className={'chip' + (statusFilter === o.value ? ' chip-lime' : '')} onClick={() => changeFilter(setStatusFilter, o.value)}>{o.label}</button>
          ))}
        </div>
      </div>

      <div className="fx-list">
        {paged.length === 0 && (
          <div className="card" style={{ padding: 24, textAlign: 'center' }}>
            <p style={{ color: 'var(--ink-2)' }}>{t('partidos.noMatches')}</p>
          </div>
        )}
        {paged.map(f => (
          <FixtureCard key={f.id} fixture={f} prediction={predictionsByMatch[f.id]} groupPicks={groupPredictionsByMatch[f.id]} onPick={onPick} onScoreChange={onScoreChange} groupId={groupId} userId={userId} reactions={reactionsByMatch?.[f.id]} lockMinutesBefore={lockMinutesBefore} />
        ))}
      </div>
      {totalPages > 1 && (
        <div className="pagination-row">
          <button className="btn btn-ghost btn-sm" disabled={safePage === 0} onClick={() => setPage(p => p - 1)}>{t('partidos.prev')}</button>
          <span>{safePage + 1} / {totalPages}</span>
          <button className="btn btn-ghost btn-sm" disabled={safePage >= totalPages - 1} onClick={() => setPage(p => p + 1)}>{t('partidos.next')}</button>
        </div>
      )}

      {showPredictAll && (
        <PredictAllFlow
          fixtures={fixtures}
          predictionsByMatch={predictionsByMatch}
          onPick={onPick}
          onScoreChange={onScoreChange}
          onClose={() => setShowPredictAll(false)}
        />
      )}
    </div>
  )
}
