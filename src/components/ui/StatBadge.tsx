'use client'

interface StatBadgeProps {
  label: string
  value: string | number
  accent?: boolean
  size?: 'sm' | 'md'
}

const getBadgeStyles = (accent: boolean, size: 'sm' | 'md') => ({
  container: `clay-inset flex flex-col gap-1 ${size === 'sm' ? 'px-3 py-2' : 'px-4 py-3'}`,
  value: {
    color: accent ? 'var(--cyan)' : 'var(--text-primary)',
    fontSize: size === 'sm' ? '1.25rem' : '1.75rem',
  },
  label: {
    color: 'var(--text-tertiary)',
    fontFamily: 'var(--font-display)',
  },
})

export default function StatBadge({ label, value, accent = false, size = 'md' }: StatBadgeProps) {
  const styles = getBadgeStyles(accent, size)
  return (
    <div className={styles.container}>
      <span className="font-display font-bold leading-none" style={styles.value}>
        {value}
      </span>
      <span className="text-xs uppercase tracking-widest" style={styles.label}>
        {label}
      </span>
    </div>
  )
}