import { useMemo, useState, useCallback, useRef, useEffect } from 'react'
import { useNavigate } from '@tanstack/react-router'
import { useTasks } from '@/hooks/use-tasks'
import { useProjects } from '@/hooks/use-projects'
import { useToday } from '@/hooks/use-date-utils'
import { useCaldavEvents, useCaldavCalendars } from '@/hooks/use-caldav'
import type { CaldavEvent } from '@/hooks/use-caldav'
import type { Task, TaskStatus } from '@/types'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { HugeiconsIcon } from '@hugeicons/react'
import { ArrowLeft01Icon, ArrowRight01Icon, Calendar03Icon, Location01Icon, Clock01Icon, TextIcon } from '@hugeicons/core-free-icons'
import { NonWorktreeTaskModal } from '@/components/task/non-worktree-task-modal'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'

const STATUS_COLORS: Record<TaskStatus, { bg: string; border: string; text: string }> = {
  TO_DO: { bg: 'bg-gray-100', border: 'border-gray-400', text: 'text-gray-700' },
  IN_PROGRESS: { bg: 'bg-gray-200', border: 'border-gray-500', text: 'text-gray-700' },
  IN_REVIEW: { bg: 'bg-amber-100', border: 'border-amber-500', text: 'text-amber-800' },
  DONE: { bg: 'bg-emerald-100', border: 'border-emerald-600', text: 'text-emerald-800' },
  CANCELED: { bg: 'bg-red-100', border: 'border-red-500', text: 'text-red-800' },
}

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

interface TaskCalendarProps {
  className?: string
  projectFilter?: string | null
  tagsFilter?: string[]
  sidebar?: (gridHeight: number | undefined) => React.ReactNode
}

export function TaskCalendar({ className, projectFilter, tagsFilter, sidebar }: TaskCalendarProps) {
  const navigate = useNavigate()
  const { data: tasks = [] } = useTasks()
  const { data: projects = [] } = useProjects()
  const [currentDate, setCurrentDate] = useState(() => new Date())
  const [selectedTask, setSelectedTask] = useState<Task | null>(null)
  const [modalOpen, setModalOpen] = useState(false)
  const [selectedEvent, setSelectedEvent] = useState<CaldavEvent | null>(null)
  const [eventModalOpen, setEventModalOpen] = useState(false)
  const [selectedDay, setSelectedDay] = useState<string | null>(null)
  const [dayDialogOpen, setDayDialogOpen] = useState(false)
  const gridRef = useRef<HTMLDivElement>(null)
  const [gridHeight, setGridHeight] = useState<number | undefined>(undefined)

  // Measure grid height to constrain sidebar
  useEffect(() => {
    if (!gridRef.current) return
    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        setGridHeight(entry.contentRect.height)
      }
    })
    observer.observe(gridRef.current)
    return () => observer.disconnect()
  }, [])

  // Build sets of repository IDs and paths that belong to projects
  const { projectRepoIds, projectRepoPaths } = useMemo(() => {
    const repoIds = new Set<string>()
    const repoPaths = new Set<string>()
    for (const project of projects) {
      for (const repo of project.repositories) {
        repoIds.add(repo.id)
        repoPaths.add(repo.path)
      }
    }
    return { projectRepoIds: repoIds, projectRepoPaths: repoPaths }
  }, [projects])

  // Helper to check if a task matches the project filter
  const taskMatchesProjectFilter = useCallback(
    (task: Task): boolean => {
      if (!projectFilter) return true
      if (projectFilter === 'inbox') {
        // Inbox = tasks not associated with any project (directly or via repository)
        return (
          !task.projectId &&
          (!task.repositoryId || !projectRepoIds.has(task.repositoryId)) &&
          (!task.repoPath || !projectRepoPaths.has(task.repoPath))
        )
      }
      // Match specific project
      if (task.projectId === projectFilter) return true
      // Also match tasks whose repository belongs to the project
      const project = projects.find((p) => p.id === projectFilter)
      if (project) {
        const repoIds = new Set(project.repositories.map((r) => r.id))
        const repoPaths = new Set(project.repositories.map((r) => r.path))
        if (task.repositoryId && repoIds.has(task.repositoryId)) return true
        if (task.repoPath && repoPaths.has(task.repoPath)) return true
      }
      return false
    },
    [projectFilter, projects, projectRepoIds, projectRepoPaths]
  )

  // Helper to check if a task matches the tags filter (OR logic)
  const taskMatchesTagsFilter = useCallback(
    (task: Task): boolean => {
      if (!tagsFilter || tagsFilter.length === 0) return true
      return task.tags.some((tag) => tagsFilter.includes(tag))
    },
    [tagsFilter]
  )

  // Get filtered tasks with due dates grouped by date
  const tasksByDate = useMemo(() => {
    const map = new Map<string, Task[]>()
    for (const task of tasks) {
      if (task.dueDate) {
        // Apply filters
        if (!taskMatchesProjectFilter(task)) continue
        if (!taskMatchesTagsFilter(task)) continue

        const dateKey = task.dueDate.split('T')[0] // YYYY-MM-DD
        if (!map.has(dateKey)) {
          map.set(dateKey, [])
        }
        map.get(dateKey)!.push(task)
      }
    }
    return map
  }, [tasks, taskMatchesProjectFilter, taskMatchesTagsFilter])

  // Calculate calendar grid
  const calendarDays = useMemo(() => {
    const year = currentDate.getFullYear()
    const month = currentDate.getMonth()

    const firstDay = new Date(year, month, 1)
    const lastDay = new Date(year, month + 1, 0)

    const startDate = new Date(firstDay)
    startDate.setDate(startDate.getDate() - firstDay.getDay())

    const endDate = new Date(lastDay)
    endDate.setDate(endDate.getDate() + (6 - lastDay.getDay()))

    const days: Date[] = []
    const current = new Date(startDate)
    while (current <= endDate) {
      days.push(new Date(current))
      current.setDate(current.getDate() + 1)
    }

    return days
  }, [currentDate])

  // CalDAV events for the visible date range
  const dateRange = useMemo(() => {
    if (calendarDays.length === 0) return { from: undefined, to: undefined }
    const first = calendarDays[0]
    const last = calendarDays[calendarDays.length - 1]
    return {
      from: first.toISOString().split('T')[0],
      to: last.toISOString().split('T')[0],
    }
  }, [calendarDays])

  const { data: caldavEvents = [] } = useCaldavEvents(dateRange.from, dateRange.to)
  const { data: caldavCalendars = [] } = useCaldavCalendars()

  const calendarColorMap = useMemo(() => {
    const map = new Map<string, string>()
    for (const cal of caldavCalendars) {
      if (cal.color) map.set(cal.id, cal.color)
    }
    return map
  }, [caldavCalendars])

  const calendarNameMap = useMemo(() => {
    const map = new Map<string, string>()
    for (const cal of caldavCalendars) {
      if (cal.displayName) map.set(cal.id, cal.displayName)
    }
    return map
  }, [caldavCalendars])

  const eventsByDate = useMemo(() => {
    const map = new Map<string, CaldavEvent[]>()
    const addEvent = (dateKey: string, event: CaldavEvent) => {
      if (!map.has(dateKey)) map.set(dateKey, [])
      map.get(dateKey)!.push(event)
    }
    for (const event of caldavEvents) {
      if (!event.dtstart) continue
      const startDate = event.dtstart.split('T')[0]
      if (event.allDay && event.dtend) {
        // Multi-day all-day events: add to each day in range (dtend is exclusive)
        const endDate = event.dtend.split('T')[0]
        const cur = new Date(startDate + 'T00:00:00')
        const end = new Date(endDate + 'T00:00:00')
        while (cur < end) {
          addEvent(cur.toISOString().split('T')[0], event)
          cur.setDate(cur.getDate() + 1)
        }
      } else {
        addEvent(startDate, event)
      }
    }
    return map
  }, [caldavEvents])

  const goToPrevMonth = () => {
    setCurrentDate((prev) => new Date(prev.getFullYear(), prev.getMonth() - 1, 1))
  }

  const goToNextMonth = () => {
    setCurrentDate((prev) => new Date(prev.getFullYear(), prev.getMonth() + 1, 1))
  }

  const goToToday = () => {
    setCurrentDate(new Date())
  }

  const handleTaskClick = (task: Task) => {
    // For code tasks, navigate to detail page
    // For non-code tasks, open the modal
    if (task.worktreePath) {
      navigate({
        to: '/tasks/$taskId',
        params: { taskId: task.id },
      })
    } else {
      setSelectedTask(task)
      setModalOpen(true)
    }
  }

  // Get today's date string in configured timezone
  const todayString = useToday()
  // Create Date object from today string for visual highlighting
  const today = new Date(todayString + 'T00:00:00')

  const monthYear = currentDate.toLocaleDateString('en-US', {
    month: 'long',
    year: 'numeric',
  })

  // Count filtered tasks with due dates
  const tasksWithDueDates = useMemo(() => {
    return tasks.filter(
      (t) => t.dueDate && taskMatchesProjectFilter(t) && taskMatchesTagsFilter(t)
    ).length
  }, [tasks, taskMatchesProjectFilter, taskMatchesTagsFilter])

  return (
    <div className={cn('flex h-full flex-col', className)}>
      {/* Header */}
      <div className="flex items-center justify-between border-b px-4 py-2">
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={goToPrevMonth}>
            <HugeiconsIcon icon={ArrowLeft01Icon} size={14} />
          </Button>
          <Button variant="outline" size="sm" onClick={goToNextMonth}>
            <HugeiconsIcon icon={ArrowRight01Icon} size={14} />
          </Button>
          <Button variant="ghost" size="sm" onClick={goToToday}>
            Today
          </Button>
        </div>
        <h2 className="text-lg font-semibold">{monthYear}</h2>
        <div className="hidden sm:block text-sm text-muted-foreground">
          {tasksWithDueDates} tasks with due dates
          {caldavEvents.length > 0 && ` · ${caldavEvents.length} events`}
        </div>
      </div>

      {/* Calendar Grid + Sidebar */}
      <div className="flex-1 overflow-auto p-4">
      <div className="flex gap-4">
      <div className="flex-1">
        <div ref={gridRef} className="grid grid-cols-7 gap-px rounded-lg border bg-border">
          {/* Weekday headers */}
          {WEEKDAYS.map((day) => (
            <div
              key={day}
              className="bg-muted px-2 py-1 text-center text-xs font-medium text-muted-foreground"
            >
              {day}
            </div>
          ))}

          {/* Calendar days */}
          {calendarDays.map((date, index) => {
            const dateKey = date.toISOString().split('T')[0]
            const dayTasks = tasksByDate.get(dateKey) || []
            const dayEvents = eventsByDate.get(dateKey) || []
            const isCurrentMonth = date.getMonth() === currentDate.getMonth()
            const isToday = date.getTime() === today.getTime()
            const totalItems = dayTasks.length + dayEvents.length
            const maxVisible = 3
            // Show tasks first, then events, up to maxVisible
            const visibleTasks = dayTasks.slice(0, maxVisible)
            const remainingSlots = maxVisible - visibleTasks.length
            const visibleEvents = remainingSlots > 0 ? dayEvents.slice(0, remainingSlots) : []
            const overflowCount = totalItems - visibleTasks.length - visibleEvents.length

            return (
              <div
                key={index}
                className={cn(
                  'min-h-[100px] bg-background p-1',
                  !isCurrentMonth && 'bg-muted/50'
                )}
              >
                <button
                  onClick={() => {
                    if (totalItems > 0) {
                      setSelectedDay(dateKey)
                      setDayDialogOpen(true)
                    }
                  }}
                  className={cn(
                    'mb-1 flex h-6 w-6 items-center justify-center rounded-full text-xs',
                    isToday && 'bg-primary text-primary-foreground font-semibold',
                    !isToday && !isCurrentMonth && 'text-muted-foreground',
                    totalItems > 0 && 'hover:bg-accent cursor-pointer'
                  )}
                >
                  {date.getDate()}
                </button>
                <div className="flex flex-col gap-0.5">
                  {visibleTasks.map((task) => {
                    const colors = STATUS_COLORS[task.status]
                    const isOverdue =
                      dateKey < todayString && task.status !== 'DONE' && task.status !== 'CANCELED'

                    return (
                      <button
                        key={task.id}
                        onClick={() => handleTaskClick(task)}
                        className={cn(
                          'w-full truncate rounded px-1 py-0.5 text-left text-[10px] border transition-opacity hover:opacity-80',
                          colors.bg,
                          colors.text,
                          isOverdue ? 'border-red-500' : colors.border
                        )}
                        title={task.title}
                      >
                        {task.title}
                      </button>
                    )
                  })}
                  {visibleEvents.map((event) => {
                    const calColor = calendarColorMap.get(event.calendarId) || '#6b7280'
                    const timeStr =
                      !event.allDay && event.dtstart?.includes('T')
                        ? event.dtstart.split('T')[1].slice(0, 5)
                        : null

                    return (
                      <button
                        key={event.id}
                        onClick={() => {
                          setSelectedEvent(event)
                          setEventModalOpen(true)
                        }}
                        className="w-full truncate rounded px-1 py-0.5 text-left text-[10px] bg-muted/60 text-muted-foreground transition-opacity hover:opacity-80 cursor-pointer"
                        style={{ borderLeft: `2px solid ${calColor}` }}
                        title={[event.summary, event.location].filter(Boolean).join(' · ')}
                      >
                        {timeStr && (
                          <span className="font-medium mr-0.5">{timeStr}</span>
                        )}
                        {event.summary || 'Untitled'}
                      </button>
                    )
                  })}
                  {overflowCount > 0 && (
                    <button
                      onClick={() => {
                        setSelectedDay(dateKey)
                        setDayDialogOpen(true)
                      }}
                      className="px-1 text-[10px] text-muted-foreground hover:text-foreground cursor-pointer text-left"
                    >
                      +{overflowCount} more
                    </button>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      </div>
      {sidebar?.(gridHeight)}
      </div>
      </div>

      {/* Non-worktree task modal */}
      {selectedTask && !selectedTask.worktreePath && (
        <NonWorktreeTaskModal
          task={selectedTask}
          open={modalOpen}
          onOpenChange={(open) => {
            setModalOpen(open)
            if (!open) setSelectedTask(null)
          }}
        />
      )}

      {/* Day detail dialog */}
      {selectedDay && (
        <DayDetailDialog
          dateKey={selectedDay}
          open={dayDialogOpen}
          onOpenChange={(open) => {
            setDayDialogOpen(open)
            if (!open) setSelectedDay(null)
          }}
          tasks={tasksByDate.get(selectedDay) || []}
          events={eventsByDate.get(selectedDay) || []}
          calendarColorMap={calendarColorMap}
          calendarNameMap={calendarNameMap}
          todayString={todayString}
          onTaskClick={(task) => {
            setDayDialogOpen(false)
            setSelectedDay(null)
            handleTaskClick(task)
          }}
          onEventClick={(event) => {
            setDayDialogOpen(false)
            setSelectedDay(null)
            setSelectedEvent(event)
            setEventModalOpen(true)
          }}
        />
      )}

      {/* CalDAV event detail dialog */}
      {selectedEvent && (
        <CaldavEventDialog
          event={selectedEvent}
          open={eventModalOpen}
          onOpenChange={(open) => {
            setEventModalOpen(open)
            if (!open) setSelectedEvent(null)
          }}
          calendarName={calendarNameMap.get(selectedEvent.calendarId)}
          calendarColor={calendarColorMap.get(selectedEvent.calendarId) || '#6b7280'}
        />
      )}
    </div>
  )
}

function formatEventDateTime(dtstart: string | null, dtend: string | null, allDay: boolean | null): string {
  if (!dtstart) return ''
  const startDate = dtstart.split('T')[0]
  const dateStr = new Date(startDate + 'T00:00:00').toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  })
  if (allDay) {
    if (dtend) {
      const endDate = dtend.split('T')[0]
      // dtend is exclusive for all-day events, so subtract one day for display
      const endDisplay = new Date(endDate + 'T00:00:00')
      endDisplay.setDate(endDisplay.getDate() - 1)
      if (endDisplay.toISOString().split('T')[0] !== startDate) {
        const endStr = endDisplay.toLocaleDateString('en-US', {
          weekday: 'long',
          month: 'long',
          day: 'numeric',
          year: 'numeric',
        })
        return `${dateStr} – ${endStr} (all day)`
      }
    }
    return `${dateStr} (all day)`
  }
  const startTime = dtstart.includes('T') ? dtstart.split('T')[1].slice(0, 5) : ''
  const endTime = dtend?.includes('T') ? dtend.split('T')[1].slice(0, 5) : ''
  if (startTime && endTime) return `${dateStr}, ${startTime} – ${endTime}`
  if (startTime) return `${dateStr}, ${startTime}`
  return dateStr
}

interface CaldavEventDialogProps {
  event: CaldavEvent
  open: boolean
  onOpenChange: (open: boolean) => void
  calendarName?: string
  calendarColor: string
}

interface DayDetailDialogProps {
  dateKey: string
  open: boolean
  onOpenChange: (open: boolean) => void
  tasks: Task[]
  events: CaldavEvent[]
  calendarColorMap: Map<string, string>
  calendarNameMap: Map<string, string>
  todayString: string
  onTaskClick: (task: Task) => void
  onEventClick: (event: CaldavEvent) => void
}

function DayDetailDialog({
  dateKey,
  open,
  onOpenChange,
  tasks,
  events,
  calendarColorMap,
  calendarNameMap,
  todayString,
  onTaskClick,
  onEventClick,
}: DayDetailDialogProps) {
  const dateTitle = new Date(dateKey + 'T00:00:00').toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  })

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{dateTitle}</DialogTitle>
        </DialogHeader>
        <div className="flex flex-col gap-1 max-h-[60vh] overflow-y-auto">
          {tasks.map((task) => {
            const colors = STATUS_COLORS[task.status]
            const isOverdue =
              dateKey < todayString && task.status !== 'DONE' && task.status !== 'CANCELED'

            return (
              <button
                key={task.id}
                onClick={() => onTaskClick(task)}
                className={cn(
                  'w-full truncate rounded px-2 py-1.5 text-left text-sm border transition-opacity hover:opacity-80',
                  colors.bg,
                  colors.text,
                  isOverdue ? 'border-red-500' : colors.border
                )}
                title={task.title}
              >
                {task.title}
              </button>
            )
          })}
          {events.map((event) => {
            const calColor = calendarColorMap.get(event.calendarId) || '#6b7280'
            const calName = calendarNameMap.get(event.calendarId)
            const timeStr =
              !event.allDay && event.dtstart?.includes('T')
                ? event.dtstart.split('T')[1].slice(0, 5)
                : null

            return (
              <button
                key={event.id}
                onClick={() => onEventClick(event)}
                className="w-full truncate rounded px-2 py-1.5 text-left text-sm bg-muted/60 text-muted-foreground transition-opacity hover:opacity-80 cursor-pointer"
                style={{ borderLeft: `3px solid ${calColor}` }}
                title={[event.summary, event.location].filter(Boolean).join(' · ')}
              >
                {timeStr && <span className="font-medium mr-1">{timeStr}</span>}
                {event.summary || 'Untitled'}
                {calName && (
                  <span className="ml-1 text-xs opacity-60">· {calName}</span>
                )}
              </button>
            )
          })}
          {tasks.length === 0 && events.length === 0 && (
            <p className="text-sm text-muted-foreground py-2 text-center">No items for this day</p>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}

function Linkify({ children }: { children: string }) {
  const urlRegex = /(https?:\/\/[^\s<]+)/g
  const parts = children.split(urlRegex)

  return (
    <>
      {parts.map((part, i) =>
        urlRegex.test(part) ? (
          <a
            key={i}
            href={part}
            target="_blank"
            rel="noopener noreferrer"
            className="text-primary underline underline-offset-2 hover:text-primary/80 break-all"
          >
            {part}
          </a>
        ) : (
          part
        ),
      )}
    </>
  )
}

function CaldavEventDialog({ event, open, onOpenChange, calendarName, calendarColor }: CaldavEventDialogProps) {
  const dateTimeStr = formatEventDateTime(event.dtstart, event.dtend, event.allDay)

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{event.summary || 'Untitled Event'}</DialogTitle>
        </DialogHeader>
        <div className="flex flex-col gap-3 text-sm">
          {dateTimeStr && (
            <div className="flex items-start gap-2 text-muted-foreground">
              <HugeiconsIcon icon={Clock01Icon} size={16} className="mt-0.5 shrink-0" />
              <span>{dateTimeStr}</span>
            </div>
          )}
          {event.location && (
            <div className="flex items-start gap-2 text-muted-foreground">
              <HugeiconsIcon icon={Location01Icon} size={16} className="mt-0.5 shrink-0" />
              <span><Linkify>{event.location}</Linkify></span>
            </div>
          )}
          {calendarName && (
            <div className="flex items-start gap-2 text-muted-foreground">
              <HugeiconsIcon icon={Calendar03Icon} size={16} className="mt-0.5 shrink-0" />
              <div className="flex items-center gap-1.5">
                <span
                  className="inline-block h-2.5 w-2.5 rounded-full shrink-0"
                  style={{ backgroundColor: calendarColor }}
                />
                <span>{calendarName}</span>
              </div>
            </div>
          )}
          {event.description && (
            <div className="flex items-start gap-2 text-muted-foreground">
              <HugeiconsIcon icon={TextIcon} size={16} className="mt-0.5 shrink-0" />
              <p className="whitespace-pre-wrap"><Linkify>{event.description}</Linkify></p>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
