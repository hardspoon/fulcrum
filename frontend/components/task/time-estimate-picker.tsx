import { useState } from 'react'
import { Input } from '@/components/ui/input'
import { HugeiconsIcon } from '@hugeicons/react'
import { Cancel01Icon, MoreHorizontalIcon } from '@hugeicons/core-free-icons'
import { cn } from '@/lib/utils'

const PRESETS = [1, 2, 3, 5, 8] as const

interface TimeEstimatePickerProps {
  value: number | null
  onChange: (value: number | null) => void
  className?: string
}

export function TimeEstimatePicker({ value, onChange, className }: TimeEstimatePickerProps) {
  const [showCustom, setShowCustom] = useState(false)
  const [customInput, setCustomInput] = useState('')

  const isPreset = value != null && (PRESETS as readonly number[]).includes(value)

  const handlePresetClick = (preset: number) => {
    if (value === preset) {
      onChange(null)
    } else {
      onChange(preset)
      setShowCustom(false)
    }
  }

  const handleCustomSubmit = () => {
    const num = parseInt(customInput, 10)
    if (num >= 1 && num <= 8) {
      onChange(num)
      setShowCustom(false)
      setCustomInput('')
    }
  }

  const handleCustomKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      handleCustomSubmit()
    } else if (e.key === 'Escape') {
      setShowCustom(false)
      setCustomInput('')
    }
  }

  return (
    <div className={cn('flex items-center gap-1', className)}>
      {PRESETS.map((preset) => (
        <button
          key={preset}
          type="button"
          onClick={() => handlePresetClick(preset)}
          className={cn(
            'rounded-md px-2 py-1 text-xs font-medium transition-colors',
            value === preset
              ? 'bg-primary text-primary-foreground'
              : 'bg-muted/50 text-muted-foreground hover:bg-muted hover:text-foreground'
          )}
        >
          {preset}h
        </button>
      ))}

      {showCustom ? (
        <Input
          type="number"
          min={1}
          max={8}
          value={customInput}
          onChange={(e) => setCustomInput(e.target.value)}
          onKeyDown={handleCustomKeyDown}
          onBlur={() => {
            if (customInput) handleCustomSubmit()
            else setShowCustom(false)
          }}
          placeholder="h"
          className="w-12 h-7 px-1.5 text-xs text-center"
          autoFocus
        />
      ) : (
        <button
          type="button"
          onClick={() => setShowCustom(true)}
          className={cn(
            'rounded-md px-1.5 py-1 text-xs font-medium transition-colors',
            value != null && !isPreset
              ? 'bg-primary text-primary-foreground'
              : 'bg-muted/50 text-muted-foreground hover:bg-muted hover:text-foreground'
          )}
          title="Custom value"
        >
          {value != null && !isPreset ? `${value}h` : (
            <HugeiconsIcon icon={MoreHorizontalIcon} size={14} />
          )}
        </button>
      )}

      {value != null && (
        <button
          type="button"
          onClick={() => {
            onChange(null)
            setShowCustom(false)
          }}
          className="text-muted-foreground hover:text-foreground ml-0.5"
          title="Clear estimate"
        >
          <HugeiconsIcon icon={Cancel01Icon} size={12} />
        </button>
      )}
    </div>
  )
}
