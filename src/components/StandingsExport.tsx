import { useRef, useState } from 'react'
import { useLocale } from '../contexts/LocaleContext'
import type { RankedStanding } from '../lib/ranking'

export function StandingsExport({ standings, groupName }: {
  standings: RankedStanding[]
  groupName: string
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [exporting, setExporting] = useState(false)
  const { locale, t } = useLocale()

  async function handleExport() {
    setExporting(true)
    try {
      const canvas = canvasRef.current
      if (!canvas) return

      const dpr = 2
      const W = 600
      const rowH = 40
      const headerH = 100
      const footerH = 50
      const H = headerH + standings.length * rowH + footerH
      canvas.width = W * dpr
      canvas.height = H * dpr
      canvas.style.width = `${W}px`
      canvas.style.height = `${H}px`

      const ctx = canvas.getContext('2d')
      if (!ctx) return
      ctx.scale(dpr, dpr)

      // Background
      ctx.fillStyle = '#090c0f'
      ctx.fillRect(0, 0, W, H)

      // Header
      ctx.fillStyle = '#c6ff32'
      ctx.font = 'bold 28px "Archivo", system-ui, sans-serif'
      ctx.textAlign = 'center'
      ctx.fillText(t('export.title'), W / 2, 40)

      ctx.fillStyle = '#aeb7bf'
      ctx.font = '16px "Hanken Grotesk", system-ui, sans-serif'
      ctx.fillText(groupName, W / 2, 65)

      const today = new Date().toLocaleDateString(locale, { day: 'numeric', month: 'long', year: 'numeric' })
      ctx.fillStyle = '#6f7984'
      ctx.font = '13px "Hanken Grotesk", system-ui, sans-serif'
      ctx.fillText(today, W / 2, 85)

      // Rows
      ctx.textAlign = 'left'
      for (let i = 0; i < standings.length; i++) {
        const s = standings[i]
        const y = headerH + i * rowH

        // Alternate row bg
        if (i % 2 === 0) {
          ctx.fillStyle = 'rgba(255,255,255,0.03)'
          ctx.fillRect(0, y, W, rowH)
        }

        // Rank
        ctx.fillStyle = s.rank <= 3 ? '#c6ff32' : '#6f7984'
        ctx.font = 'bold 16px "Archivo", system-ui, sans-serif'
        ctx.fillText(`${s.rank}`, 24, y + 26)

        // Medal
        const medals = ['', '\uD83E\uDD47', '\uD83E\uDD48', '\uD83E\uDD49']
        if (s.rank <= 3) {
          ctx.font = '18px serif'
          ctx.fillText(medals[s.rank], 50, y + 27)
        }

        // Name
        ctx.fillStyle = '#f3f6f5'
        ctx.font = '15px "Hanken Grotesk", system-ui, sans-serif'
        ctx.fillText(s.display_name ?? t('common.noName'), 80, y + 26)

        // Points
        ctx.fillStyle = '#c6ff32'
        ctx.font = 'bold 18px "Archivo", system-ui, sans-serif'
        ctx.textAlign = 'right'
        ctx.fillText(`${s.points} ${t('tabla.pts')}`, W - 30, y + 26)

        // Exact count
        if (s.exact_count > 0) {
          ctx.fillStyle = '#ffc233'
          ctx.font = '12px "Hanken Grotesk", system-ui, sans-serif'
          ctx.fillText(`${s.exact_count} ${s.exact_count > 1 ? t('tabla.exacts') : t('tabla.exact')}`, W - 100, y + 26)
        }

        ctx.textAlign = 'left'
      }

      // Footer
      ctx.fillStyle = '#6f7984'
      ctx.font = '11px "Hanken Grotesk", system-ui, sans-serif'
      ctx.textAlign = 'center'
      ctx.fillText('lapolla.app', W / 2, H - 18)

      canvas.toBlob(async (blob) => {
        if (!blob) return
        const file = new File([blob], t('export.filename'), { type: 'image/png' })

        if (navigator.share && navigator.canShare?.({ files: [file] })) {
          try {
            await navigator.share({ files: [file], title: `${t('tabla.heading')} - ${groupName}` })
          } catch {
            // User cancelled share
          }
        } else {
          const url = URL.createObjectURL(blob)
          const a = document.createElement('a')
          a.href = url
          a.download = t('export.filename')
          a.click()
          URL.revokeObjectURL(url)
        }
      }, 'image/png')
    } finally {
      setExporting(false)
    }
  }

  return (
    <>
      <button className="btn btn-ghost btn-sm" onClick={handleExport} disabled={exporting}>
        <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2.2" style={{ marginRight: 4 }}>
          <path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8" strokeLinecap="round" strokeLinejoin="round" />
          <polyline points="16 6 12 2 8 6" strokeLinecap="round" strokeLinejoin="round" />
          <line x1="12" y1="2" x2="12" y2="15" strokeLinecap="round" />
        </svg>
        {exporting ? t('export.exporting') : t('export.share')}
      </button>
      <canvas ref={canvasRef} style={{ position: 'absolute', left: -9999, top: -9999, pointerEvents: 'none' }} />
    </>
  )
}
