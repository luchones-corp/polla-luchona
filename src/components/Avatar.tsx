export function Avatar({ name, size = 38 }: { name: string; size?: number }) {
  const initials = name.replace(/[._-]/g, ' ').split(' ').filter(Boolean).slice(0, 2).map(s => s[0].toUpperCase()).join('')
  return (
    <div className="avatar" style={{
      width: size, height: size, fontSize: size * 0.38,
      background: 'linear-gradient(150deg, var(--lime), var(--lime-deep))',
      boxShadow: '0 4px 14px rgba(198,255,50,.3)',
    }}>{initials}</div>
  )
}
