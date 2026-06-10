import { useMemo, useState } from 'react'
import type { LeaderboardSnapshot } from '../lib/types'

const COLORS = ['#c6ff32', '#36e0ff', '#ffc233', '#ff2d6e', '#ff8a3d', '#a78bfa', '#34d399', '#f472b6']

type Props = {
  data: LeaderboardSnapshot[]
  userId: string
}

export function LeaderboardChart({ data, userId }: Props) {
  const [hoveredUser, setHoveredUser] = useState<string | null>(null)

  const { users, matchTicks, maxPoints, lines } = useMemo(() => {
    // Collect unique users and match ticks
    const userMap = new Map<string, { id: string; name: string; colorIndex: number }>()
    const matchMap = new Map<number, string>() // matchId -> kickoff_at
    const pointsMap = new Map<string, Map<number, number>>() // userId -> matchId -> cumulativePoints

    for (const snap of data) {
      if (!userMap.has(snap.user_id)) {
        userMap.set(snap.user_id, {
          id: snap.user_id,
          name: snap.display_name ?? '?',
          colorIndex: userMap.size,
        })
      }
      matchMap.set(snap.match_id, snap.kickoff_at)

      if (!pointsMap.has(snap.user_id)) pointsMap.set(snap.user_id, new Map())
      pointsMap.get(snap.user_id)!.set(snap.match_id, snap.cumulative_points)
    }

    const users = [...userMap.values()]
    const matchTicks = [...matchMap.entries()]
      .sort((a, b) => new Date(a[1]).getTime() - new Date(b[1]).getTime())
      .map(([id]) => id)

    let maxPoints = 0
    const lines = users.map(u => {
      const points = matchTicks.map(mId => {
        const p = pointsMap.get(u.id)?.get(mId) ?? 0
        if (p > maxPoints) maxPoints = p
        return p
      })
      return { ...u, points }
    })

    return { users, matchTicks, maxPoints: Math.max(maxPoints, 1), lines }
  }, [data])

  if (matchTicks.length === 0) {
    return (
      <div className="card" style={{ padding: 24, textAlign: 'center' }}>
        <p style={{ color: 'var(--ink-2)' }}>No hay partidos finalizados para graficar.</p>
      </div>
    )
  }

  const W = 800
  const H = 400
  const PAD = { top: 20, right: 20, bottom: 30, left: 40 }
  const plotW = W - PAD.left - PAD.right
  const plotH = H - PAD.top - PAD.bottom

  const xStep = matchTicks.length > 1 ? plotW / (matchTicks.length - 1) : plotW
  const yScale = plotH / maxPoints

  // Y-axis grid lines
  const yTicks: number[] = []
  const yStep = Math.max(1, Math.ceil(maxPoints / 5))
  for (let i = 0; i <= maxPoints; i += yStep) yTicks.push(i)
  if (yTicks[yTicks.length - 1] < maxPoints) yTicks.push(maxPoints)

  return (
    <div className="chart-container">
      <svg viewBox={`0 0 ${W} ${H}`} className="chart-svg">
        {/* Grid lines */}
        {yTicks.map(tick => {
          const y = PAD.top + plotH - tick * yScale
          return (
            <g key={tick}>
              <line x1={PAD.left} y1={y} x2={W - PAD.right} y2={y} stroke="var(--line)" strokeWidth="1" />
              <text x={PAD.left - 8} y={y + 4} textAnchor="end" fill="var(--ink-3)" fontSize="11" fontFamily="var(--font-head)">{tick}</text>
            </g>
          )
        })}

        {/* Lines */}
        {lines.map(line => {
          const color = COLORS[line.colorIndex % COLORS.length]
          const isMe = line.id === userId
          const isHovered = hoveredUser === line.id
          const opacity = hoveredUser ? (isHovered ? 1 : 0.2) : (isMe ? 1 : 0.6)
          const strokeWidth = isMe || isHovered ? 3 : 1.5

          const pathD = line.points.map((p, i) => {
            const x = PAD.left + (matchTicks.length > 1 ? i * xStep : plotW / 2)
            const y = PAD.top + plotH - p * yScale
            return `${i === 0 ? 'M' : 'L'}${x},${y}`
          }).join(' ')

          return (
            <g key={line.id}>
              <path
                d={pathD}
                fill="none"
                stroke={color}
                strokeWidth={strokeWidth}
                strokeLinecap="round"
                strokeLinejoin="round"
                opacity={opacity}
                style={{ transition: 'opacity .2s, stroke-width .2s' }}
              />
              {/* End dot */}
              {line.points.length > 0 && (
                <circle
                  cx={PAD.left + (matchTicks.length > 1 ? (line.points.length - 1) * xStep : plotW / 2)}
                  cy={PAD.top + plotH - line.points[line.points.length - 1] * yScale}
                  r={isMe || isHovered ? 5 : 3}
                  fill={color}
                  opacity={opacity}
                />
              )}
            </g>
          )
        })}

        {/* X-axis label */}
        <text x={PAD.left + plotW / 2} y={H - 4} textAnchor="middle" fill="var(--ink-3)" fontSize="11" fontFamily="var(--font-head)">
          Partidos ({matchTicks.length})
        </text>
      </svg>

      <div className="chart-legend">
        {lines.map(line => {
          const color = COLORS[line.colorIndex % COLORS.length]
          const isMe = line.id === userId
          const finalPts = line.points[line.points.length - 1] ?? 0
          return (
            <button
              key={line.id}
              className={'chart-legend-item' + (isMe ? ' me' : '')}
              onMouseEnter={() => setHoveredUser(line.id)}
              onMouseLeave={() => setHoveredUser(null)}
              onClick={() => setHoveredUser(h => h === line.id ? null : line.id)}
            >
              <span className="chart-legend-dot" style={{ background: color }} />
              <span className="chart-legend-name">{line.name}{isMe ? ' (TU)' : ''}</span>
              <span className="chart-legend-pts">{finalPts}</span>
            </button>
          )
        })}
      </div>
    </div>
  )
}
