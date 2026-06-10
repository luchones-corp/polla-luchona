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
  const [groupFilter, setGroupFilter] = useState<string>('todos')

  const stageOptions: { value: StageFilter; label: string }[] = [
    { value: 'todos', label: t('partidos.allStages') },
    { value: 'group', label: t('partidos.groups') },
    { value: 'r32', label: 'R32' },
    { value: 'r16', label: 'R16' },
    { value: 'qf', label: t('partidos.qf') },
    { value: 'sf', label: t('partidos.sf') },
    { value: 'final', label: t('partidos.final') },
  ]
  const dateOptions: { value: DateFilter; label: string }[] = [
    { value: 'todos', label: t('partidos.anyTime') },
    { value: 'hoy', label: t('partidos.today') },
    { value: 'mañana', label: t('partidos.tomorrow') },
  ]

  const availableGroups = useMemo(() => {
    const labels = new Set<string>()
    for (const f of fixtures) {
      if (f.stage === 'group' && f.group_label) labels.add(f.group_label)
    }
    return [...labels].sort()
  }, [fixtures])

  const showGroupDropdown = availableGroups.length > 0 && (stageFilter === 'todos' || stageFilter === 'group')

  const pending = fixtures.filter(f => isBeforeKickoff(f.kickoff_at) && !predictionsByMatch[f.id]).length
  const predicted = fixtures.filter(f => !!predictionsByMatch[f.id]).length

  const filtered = useMemo(() => {
    return fixtures.filter(f => {
      if (stageFilter !== 'todos' && f.stage !== stageFilter) return false
      if (showGroupDropdown && groupFilter !== 'todos') {
        if (f.stage !== 'group' || f.group_label !== groupFilter) return false
      }
      if (dateFilter === 'hoy' && !isToday(f.kickoff_at)) return false
      if (dateFilter === 'mañana' && !isTomorrow(f.kickoff_at)) return false
      if (statusFilter === 'pendiente' && (!isBeforeKickoff(f.kickoff_at) || !!predictionsByMatch[f.id])) return false
      if (statusFilter === 'predicho' && !predictionsByMatch[f.id]) return false
      return true
    })
  }, [fixtures, predictionsByMatch, stageFilter, dateFilter, statusFilter, groupFilter, showGroupDropdown])

  const PER_PAGE = 10
  const totalPages = Math.max(1, Math.ceil(filtered.length / PER_PAGE))
  const safePage = Math.min(page, totalPages - 1)
  const paged = filtered.slice(safePage * PER_PAGE, (safePage + 1) * PER_PAGE)

  const sections = useMemo(() => {
    const result: { label: string | null; fixtures: Fixture[] }[] = []
    let currentLabel: string | null = null
    let currentGroup: Fixture[] = []
    for (const f of paged) {
      const label = f.stage === 'group' && f.group_label
        ? `${t('partidos.groupLabel')} ${f.group_label}`
        : null
      if (label !== currentLabel) {
        if (currentGroup.length > 0) result.push({ label: currentLabel, fixtures: currentGroup })
        currentLabel = label
        currentGroup = [f]
      } else {
        currentGroup.push(f)
      }
    }
    if (currentGroup.length > 0) result.push({ label: currentLabel, fixtures: currentGroup })
    return result
  }, [paged, t])

  const hasActiveFilters = stageFilter !== 'todos' || dateFilter !== 'todos' || statusFilter !== 'todos' || groupFilter !== 'todos'

  function clearFilters() {
    setStageFilter('todos')
    setDateFilter('todos')
    setStatusFilter('todos')
    setGroupFilter('todos')
    setPage(0)
  }

  function setFilterAndReset<T>(setter: (v: T) => void, value: T) {
    setter(value)
    setPage(0)
  }

  return (
    <div className="wrap fade-in">
      <div className="sec-head">
        <h2>{t('partidos.heading')}</h2>
      </div>

      {/* --- Status segmented control + Predict All --- */}
      <div className="partidos-status-row">
        <div className="seg-control">
          <button
            className={'seg-btn' + (statusFilter === 'todos' ? ' active' : '')}
            onClick={() => setFilterAndReset(setStatusFilter, 'todos')}
          >
            {t('partidos.all')}
            <span className="seg-count">{fixtures.length}</span>
          </button>
          <button
            className={'seg-btn accent' + (statusFilter === 'pendiente' ? ' active' : '')}
            onClick={() => setFilterAndReset(setStatusFilter, 'pendiente')}
          >
            {t('partidos.toPredict')}
            {pending > 0 && <span className="seg-count hot">{pending}</span>}
          </button>
          <button
            className={'seg-btn' + (statusFilter === 'predicho' ? ' active' : '')}
            onClick={() => setFilterAndReset(setStatusFilter, 'predicho')}
          >
            {t('partidos.predicted')}
            <span className="seg-count">{predicted}</span>
          </button>
        </div>
        {pending > 0 && (
          <button className="btn btn-primary btn-sm" onClick={() => setShowPredictAll(true)}>
            {t('partidos.predictAll')}
          </button>
        )}
      </div>

      {/* --- Dropdowns row --- */}
      <div className="partidos-dropdowns">
        <label className="filter-dropdown">
          <span className="filter-dropdown-label">{t('partidos.stageLabel')}</span>
          <select
            value={stageFilter}
            onChange={e => {
              const val = e.target.value as StageFilter
              setFilterAndReset(setStageFilter, val)
              if (val !== 'todos' && val !== 'group') setGroupFilter('todos')
            }}
          >
            {stageOptions.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
        </label>

        {showGroupDropdown && (
          <label className="filter-dropdown">
            <span className="filter-dropdown-label">{t('partidos.groupLabel')}</span>
            <select
              value={groupFilter}
              onChange={e => setFilterAndReset(setGroupFilter, e.target.value)}
            >
              <option value="todos">{t('partidos.allGroups')}</option>
              {availableGroups.map(g => (
                <option key={g} value={g}>{t('partidos.groupLabel')} {g}</option>
              ))}
            </select>
          </label>
        )}

        <label className="filter-dropdown">
          <span className="filter-dropdown-label">{t('partidos.whenLabel')}</span>
          <select
            value={dateFilter}
            onChange={e => setFilterAndReset(setDateFilter, e.target.value as DateFilter)}
          >
            {dateOptions.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
        </label>

        {hasActiveFilters && (
          <button className="btn btn-ghost btn-sm filter-clear-btn" onClick={clearFilters}>
            {t('partidos.clear')} ✕
          </button>
        )}
      </div>

      {/* --- Match list --- */}
      <div className="fx-list">
        {paged.length === 0 && (
          <div className="card" style={{ padding: 24, textAlign: 'center' }}>
            <p style={{ color: 'var(--ink-2)' }}>{t('partidos.noMatches')}</p>
          </div>
        )}
        {sections.map((section, i) => (
          <div key={i}>
            {section.label && (
              <div className="fx-group-header">
                <span>{section.label}</span>
              </div>
            )}
            {section.fixtures.map(f => (
              <FixtureCard key={f.id} fixture={f} prediction={predictionsByMatch[f.id]} groupPicks={groupPredictionsByMatch[f.id]} onPick={onPick} onScoreChange={onScoreChange} groupId={groupId} userId={userId} reactions={reactionsByMatch?.[f.id]} lockMinutesBefore={lockMinutesBefore} />
            ))}
          </div>
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
