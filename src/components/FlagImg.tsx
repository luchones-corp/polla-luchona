import { getFlagUrl } from '../lib/flags'

export function FlagImg({ teamId, w = 38 }: { teamId: number | null; w?: number }) {
  const url = getFlagUrl(teamId, w > 60 ? 160 : 80)
  if (!url) return null
  return <img className="flag flag-ring" src={url} alt="" width={w} height={Math.round(w * 0.68)} style={{ borderRadius: w > 40 ? 6 : 4 }} draggable={false} />
}
