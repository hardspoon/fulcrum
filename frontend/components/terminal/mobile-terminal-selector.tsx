import { useRef, useEffect } from 'react'
import { cn } from '@/lib/utils'
import type { TerminalInfo } from '@/hooks/use-terminal-ws'

interface TaskInfo {
  taskId: string
  title: string
}

interface MobileTerminalSelectorProps {
  terminals: TerminalInfo[]
  activeIndex: number
  onSelect: (index: number) => void
  /** Map terminal cwd to task info for display */
  taskInfoByCwd?: Map<string, TaskInfo>
}

export function MobileTerminalSelector({
  terminals,
  activeIndex,
  onSelect,
  taskInfoByCwd,
}: MobileTerminalSelectorProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const activeButtonRef = useRef<HTMLButtonElement>(null)

  // Auto-scroll to keep active terminal visible
  useEffect(() => {
    if (activeButtonRef.current && containerRef.current) {
      activeButtonRef.current.scrollIntoView({
        behavior: 'smooth',
        block: 'nearest',
        inline: 'center',
      })
    }
  }, [activeIndex])

  const getTerminalLabel = (terminal: TerminalInfo, index: number) => {
    // For task terminals, show task title
    if (terminal.cwd && taskInfoByCwd) {
      const taskInfo = taskInfoByCwd.get(terminal.cwd)
      if (taskInfo) {
        return taskInfo.title
      }
    }
    // For regular terminals, show name or fallback to number
    return terminal.name || `Terminal ${index + 1}`
  }

  return (
    <div
      ref={containerRef}
      className="flex shrink-0 gap-1 overflow-x-auto border-b border-border bg-card px-2 py-1.5"
      style={{ WebkitOverflowScrolling: 'touch' }}
    >
      {terminals.map((terminal, index) => {
        const isActive = index === activeIndex
        const label = getTerminalLabel(terminal, index)

        return (
          <button
            key={terminal.id}
            ref={isActive ? activeButtonRef : null}
            onClick={() => onSelect(index)}
            className={cn(
              'shrink-0 rounded-md px-3 py-1.5 text-xs font-medium transition-colors touch-manipulation',
              'max-w-[150px] truncate',
              isActive
                ? 'bg-primary text-primary-foreground'
                : 'bg-muted text-muted-foreground hover:bg-muted/80'
            )}
          >
            {label}
          </button>
        )
      })}
    </div>
  )
}
