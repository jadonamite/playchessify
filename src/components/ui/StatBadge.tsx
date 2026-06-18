'use client'
interface StatBadgeProps {
  label: string
  value: string | number
  accent?: boolean
  size?: 'sm' | 'md'
}

const getSpanStyles = (accent: boolean, size: 'sm' | 'md') => ({
  color: accent ? 'var(--cyan)' : 'var(--text-primary)',
  fontSize: size === 'sm' ? '1.25rem' : '1.75rem',
})

const getContainerClasses = (size: 'sm' | 'md') => `clay-inset flex flex-col gap-1 ${size === 'sm' ? 'px-3 py-2' : 'px-4 py-3'}`

const getLabelStyles = () => ({
  color: 'var(--text-tertiary)',
  fontFamily: 'var(--font-display)',
})

export default function StatBadge({ label, value, accent = false, size = 'md' }: StatBadgeProps) {
  return (
    <div className={getContainerClasses(size)}>
      <span className="font-display font-bold leading-none" style={getSpanStyles(accent, size)}>
        {value}
      </span>
      <span className="text-xs uppercase tracking-widest" style={getLabelStyles()}>
        {label}
      </span>
    </div>
  )
}