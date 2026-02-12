import { useTranslation } from 'react-i18next'
import { cn } from '@/lib/utils'
import type { TaskPriority } from '@/types'

interface PriorityPickerProps {
  value: TaskPriority | null
  onChange: (value: TaskPriority | null) => void
  className?: string
}

export function PriorityPicker({ value, onChange, className }: PriorityPickerProps) {
  const { t } = useTranslation('tasks')

  const options: { key: TaskPriority; label: string }[] = [
    { key: 'low', label: t('priority.low') },
    { key: 'medium', label: t('priority.medium') },
    { key: 'high', label: t('priority.high') },
  ]

  return (
    <div className={cn('flex items-center gap-1', className)}>
      {options.map(({ key, label }) => (
        <button
          key={key}
          type="button"
          onClick={() => onChange(value === key ? null : key)}
          className={cn(
            'rounded-md px-2 py-1 text-xs font-medium transition-colors',
            value === key
              ? key === 'high'
                ? 'bg-destructive text-destructive-foreground'
                : key === 'low'
                  ? 'bg-muted text-muted-foreground'
                  : 'bg-primary text-primary-foreground'
              : 'bg-muted/50 text-muted-foreground hover:bg-muted hover:text-foreground'
          )}
        >
          {label}
        </button>
      ))}
    </div>
  )
}
