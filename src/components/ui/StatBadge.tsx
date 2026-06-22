'use client'
interface StatBadgeProps {
  label: string
  value: string | number
  accent?: boolean
  size?: 'sm' | 'md'
}

const getBadgeClassName = (size: 'sm' | 'md') => {
  return `clay-inset flex flex-col gap-1 ${size === 'sm' ? 'px-3 py-2' : 'px-4 py-3'}`
}

const getBadgeStyles = (accent: boolean, size: 'sm' | 'md') => {
  return {
    color: accent ? 'var(--cyan)' : 'var(--text-primary)',
    fontSize: size === 'sm' ? '1.25rem' : '1.75rem',
  }
}

const getLabelStyles = () => {
  return {
    color: 'var(--text-tertiary)',
    fontFamily: 'var(--font-display)',
  }
}

export default function StatBadge({ label, value, accent = false, size = 'md' }: StatBadgeProps) {
  return (
    <div className={getBadgeClassName(size)}>
      <span className="font-display font-bold leading-none" style={getBadgeStyles(accent, size)}>
        {value}
      </span>
      <span className="text-xs uppercase tracking-widest" style={getLabelStyles()}>
        {label}
      </span>
    </div>
  )
}