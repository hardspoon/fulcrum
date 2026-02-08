import { useMemo, useRef, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { useToday } from '@/hooks/use-date-utils'
import type { CaldavEvent } from '@/hooks/use-caldav'
import type { Task, TaskStatus } from '@/types'
import { cn } from '@/lib/utils'
import { layoutEvents, parseTimeToMinutes } from '@/lib/calendar-layout'

const HOUR_HEIGHT = 48
const TOTAL_HOURS = 24
const GRID_HEIGHT = HOUR_HEIGHT * TOTAL_HOURS
const DEFAULT_SCROLL_HOUR = 7 // Scroll to 7 AM on mount (shows 8 AM nicely)
const DEFAULT_DURATION_MINUTES = 60

const STATUS_COLORS: Record<TaskStatus, { bg: string; border: string; text: string }> = {
  TO_DO: { bg: 'bg-gray-100 dark:bg-gray-800', border: 'border-gray-400', text: 'text-gray-700 dark:text-gray-300' },
  IN_PROGRESS: { bg: 'bg-gray-200 dark:bg-gray-700', border: 'border-gray-500', text: 'text-gray-700 dark:text-gray-300' },
  IN_REVIEW: { bg: 'bg-amber-100 dark:bg-amber-900/40', border: 'border-amber-500', text: 'text-amber-800 dark:text-amber-200' },
  DONE: { bg: 'bg-emerald-100 dark:bg-emerald-900/40', border: 'border-emerald-600', text: 'text-emerald-800 dark:text-emerald-200' },
  CANCELED: { bg: 'bg-red-100 dark:bg-red-900/40', border: 'border-red-500', text: 'text-red-800 dark:text-red-200' },
}

interface WeekViewProps {
  weekDays: Date[]
  tasksByDate: Map<string, Task[]>
  eventsByDate: Map<string, CaldavEvent[]>
  calendarColorMap: Map<string, string>
  onTaskClick: (task: Task) => void
  onEventClick: (event: CaldavEvent) => void
}

export function WeekView({
  weekDays,
  tasksByDate,
  eventsByDate,
  calendarColorMap,
  onTaskClick,
  onEventClick,
}: WeekViewProps) {
  const scrollRef = useRef<HTMLDivElement>(null)
  const gridRef = useRef<HTMLDivElement>(null)
  const todayString = useToday()
  const hasScrolled = useRef(false)
  const { i18n } = useTranslation()

  // Auto-scroll to current hour or default on mount
  useEffect(() => {
    if (hasScrolled.current || !scrollRef.current || !gridRef.current) return
    hasScrolled.current = true
    const now = new Date()
    const isThisWeek = weekDays.some(
      (d) => d.toISOString().split('T')[0] === todayString
    )
    const scrollHour = isThisWeek ? Math.max(now.getHours() - 1, 0) : DEFAULT_SCROLL_HOUR
    // Account for sticky header height
    const gridTop = gridRef.current.offsetTop
    scrollRef.current.scrollTop = gridTop + scrollHour * HOUR_HEIGHT
  }, [weekDays, todayString])

  // Separate all-day events/tasks from timed events for each day
  const { allDayByDate, timedByDate } = useMemo(() => {
    const allDay = new Map<string, Array<{ type: 'task'; task: Task } | { type: 'event'; event: CaldavEvent }>>()
    const timed = new Map<string, CaldavEvent[]>()

    for (const day of weekDays) {
      const dateKey = day.toISOString().split('T')[0]
      const dayTasks = tasksByDate.get(dateKey) || []
      const dayEvents = eventsByDate.get(dateKey) || []

      const allDayItems: Array<{ type: 'task'; task: Task } | { type: 'event'; event: CaldavEvent }> = []
      const timedEvents: CaldavEvent[] = []

      // Tasks are always shown in all-day row (they have dates, not times)
      for (const task of dayTasks) {
        allDayItems.push({ type: 'task', task })
      }

      for (const event of dayEvents) {
        if (event.allDay || !event.dtstart?.includes('T')) {
          allDayItems.push({ type: 'event', event })
        } else {
          timedEvents.push(event)
        }
      }

      if (allDayItems.length > 0) allDay.set(dateKey, allDayItems)
      if (timedEvents.length > 0) timed.set(dateKey, timedEvents)
    }

    return { allDayByDate: allDay, timedByDate: timed }
  }, [weekDays, tasksByDate, eventsByDate])

  const hasAllDayItems = useMemo(() => {
    for (const day of weekDays) {
      const dateKey = day.toISOString().split('T')[0]
      if (allDayByDate.has(dateKey)) return true
    }
    return false
  }, [weekDays, allDayByDate])

  return (
    <div className="flex h-full flex-col overflow-hidden">
      {/* Single scroll container - sticky headers + time grid share the same width */}
      <div ref={scrollRef} className="relative flex-1 overflow-y-auto overflow-x-hidden">
        {/* Sticky header area */}
        <div className="sticky top-0 z-20 bg-background">
          {/* Day headers */}
          <div className="grid border-b" style={{ gridTemplateColumns: '50px repeat(7, 1fr)' }}>
            <div className="border-r" />
            {weekDays.map((day) => {
              const dateKey = day.toISOString().split('T')[0]
              const isToday = dateKey === todayString
              return (
                <div
                  key={dateKey}
                  className={cn(
                    'border-r px-1 py-1.5 text-center last:border-r-0',
                    isToday && 'bg-primary/5'
                  )}
                >
                  <div className="text-[10px] font-medium text-muted-foreground uppercase">
                    {day.toLocaleDateString(i18n.language, { weekday: 'short' })}
                  </div>
                  <div
                    className={cn(
                      'mx-auto flex h-6 w-6 items-center justify-center rounded-full text-sm font-semibold',
                      isToday && 'bg-primary text-primary-foreground'
                    )}
                  >
                    {day.getDate()}
                  </div>
                </div>
              )
            })}
          </div>

          {/* All-day row */}
          {hasAllDayItems && (
            <AllDayRow
              weekDays={weekDays}
              allDayByDate={allDayByDate}
              calendarColorMap={calendarColorMap}
              todayString={todayString}
              onTaskClick={onTaskClick}
              onEventClick={onEventClick}
            />
          )}
        </div>

        {/* Time grid */}
        <div
          ref={gridRef}
          className="relative grid"
          style={{
            gridTemplateColumns: '50px repeat(7, 1fr)',
            height: GRID_HEIGHT,
          }}
        >
          {/* Time gutter */}
          <div className="relative border-r">
            {Array.from({ length: TOTAL_HOURS }, (_, hour) => (
              <div
                key={hour}
                className="absolute right-2 -translate-y-1/2 text-[10px] text-muted-foreground"
                style={{ top: hour * HOUR_HEIGHT }}
              >
                {hour === 0 ? '' : formatHour(hour)}
              </div>
            ))}
          </div>

          {/* Day columns */}
          {weekDays.map((day) => {
            const dateKey = day.toISOString().split('T')[0]
            const isToday = dateKey === todayString
            const timedEvents = timedByDate.get(dateKey) || []

            return (
              <DayColumn
                key={dateKey}
                events={timedEvents}
                isToday={isToday}
                calendarColorMap={calendarColorMap}
                onEventClick={onEventClick}
              />
            )
          })}

          {/* Hour grid lines */}
          {Array.from({ length: TOTAL_HOURS }, (_, hour) => (
            <div
              key={hour}
              className="pointer-events-none absolute left-[50px] right-0 border-t border-border/50"
              style={{ top: hour * HOUR_HEIGHT }}
            />
          ))}
        </div>
      </div>
    </div>
  )
}

interface AllDayRowProps {
  weekDays: Date[]
  allDayByDate: Map<string, Array<{ type: 'task'; task: Task } | { type: 'event'; event: CaldavEvent }>>
  calendarColorMap: Map<string, string>
  todayString: string
  onTaskClick: (task: Task) => void
  onEventClick: (event: CaldavEvent) => void
}

function AllDayRow({
  weekDays,
  allDayByDate,
  calendarColorMap,
  todayString,
  onTaskClick,
  onEventClick,
}: AllDayRowProps) {
  const maxVisible = 3

  return (
    <div
      className="grid shrink-0 border-b"
      style={{ gridTemplateColumns: '50px repeat(7, 1fr)' }}
    >
      <div className="border-r px-1 py-1 text-[10px] text-muted-foreground text-right pr-2">
        all-day
      </div>
      {weekDays.map((day) => {
        const dateKey = day.toISOString().split('T')[0]
        const isToday = dateKey === todayString
        const items = allDayByDate.get(dateKey) || []
        const visible = items.slice(0, maxVisible)
        const overflow = items.length - maxVisible

        return (
          <div
            key={dateKey}
            className={cn(
              'border-r px-0.5 py-0.5 last:border-r-0 min-h-[28px] min-w-0 overflow-hidden',
              isToday && 'bg-primary/5'
            )}
          >
            {visible.map((item) => {
              if (item.type === 'task') {
                const colors = STATUS_COLORS[item.task.status]
                const isOverdue =
                  dateKey < todayString &&
                  item.task.status !== 'DONE' &&
                  item.task.status !== 'CANCELED'
                return (
                  <button
                    key={`task-${item.task.id}`}
                    onClick={() => onTaskClick(item.task)}
                    className={cn(
                      'w-full truncate rounded px-1 py-0.5 text-left text-[10px] border mb-0.5',
                      colors.bg,
                      colors.text,
                      isOverdue ? 'border-red-500' : colors.border,
                      'hover:opacity-80 transition-opacity'
                    )}
                    title={item.task.title}
                  >
                    {item.task.title}
                  </button>
                )
              }
              const calColor = calendarColorMap.get(item.event.calendarId) || '#6b7280'
              return (
                <button
                  key={`event-${item.event.id}`}
                  onClick={() => onEventClick(item.event)}
                  className="w-full truncate rounded px-1 py-0.5 text-left text-[10px] bg-muted/60 text-muted-foreground mb-0.5 hover:opacity-80 transition-opacity cursor-pointer"
                  style={{ borderLeft: `2px solid ${calColor}` }}
                  title={item.event.summary || 'Untitled'}
                >
                  {item.event.summary || 'Untitled'}
                </button>
              )
            })}
            {overflow > 0 && (
              <div className="text-[10px] text-muted-foreground px-1">
                +{overflow} more
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}

interface DayColumnProps {
  events: CaldavEvent[]
  isToday: boolean
  calendarColorMap: Map<string, string>
  onEventClick: (event: CaldavEvent) => void
}

function DayColumn({ events, isToday, calendarColorMap, onEventClick }: DayColumnProps) {
  const positioned = useMemo(() => {
    const items = events
      .map((event) => {
        const startMinutes = parseTimeToMinutes(event.dtstart)
        if (startMinutes === null) return null

        let endMinutes = parseTimeToMinutes(event.dtend)
        if (endMinutes === null) {
          endMinutes = startMinutes + DEFAULT_DURATION_MINUTES
        }
        // Clamp to day boundary
        endMinutes = Math.min(endMinutes, 1440)
        // Ensure end > start
        if (endMinutes <= startMinutes) {
          endMinutes = startMinutes + DEFAULT_DURATION_MINUTES
        }

        return { id: event.id, startMinutes, endMinutes }
      })
      .filter((item): item is NonNullable<typeof item> => item !== null)

    return layoutEvents(items, HOUR_HEIGHT)
  }, [events])

  const posMap = useMemo(() => {
    const map = new Map<string, (typeof positioned)[0]>()
    for (const pos of positioned) {
      map.set(pos.id, pos)
    }
    return map
  }, [positioned])

  return (
    <div className={cn('relative border-r last:border-r-0', isToday && 'bg-primary/5')}>
      {events.map((event) => {
        const pos = posMap.get(event.id)
        if (!pos) return null
        return (
          <WeekEventBlock
            key={event.id}
            event={event}
            position={pos}
            calendarColor={calendarColorMap.get(event.calendarId) || '#6b7280'}
            onClick={() => onEventClick(event)}
          />
        )
      })}
      {/* Current time indicator - rendered inside the day column to stay contained */}
      {isToday && <CurrentTimeIndicator />}
    </div>
  )
}

interface WeekEventBlockProps {
  event: CaldavEvent
  position: { top: number; height: number; left: number; width: number }
  calendarColor: string
  onClick: () => void
}

function WeekEventBlock({ event, position, calendarColor, onClick }: WeekEventBlockProps) {
  const startTime = event.dtstart?.includes('T')
    ? event.dtstart.split('T')[1].slice(0, 5)
    : null
  const endTime = event.dtend?.includes('T')
    ? event.dtend.split('T')[1].slice(0, 5)
    : null

  const isShort = position.height < 36

  return (
    <button
      onClick={onClick}
      className="absolute overflow-hidden rounded text-left transition-opacity hover:opacity-80 cursor-pointer bg-muted/80 border border-border/50 backdrop-blur-sm"
      style={{
        top: position.top,
        height: position.height,
        left: `calc(${position.left * 100}% + 1px)`,
        width: `calc(${position.width * 100}% - 2px)`,
        borderLeftWidth: 2,
        borderLeftColor: calendarColor,
      }}
      title={[
        startTime && endTime ? `${startTime} - ${endTime}` : startTime,
        event.summary,
        event.location,
      ]
        .filter(Boolean)
        .join('\n')}
    >
      <div className="px-1 py-0.5">
        {isShort ? (
          <div className="flex items-center gap-1 text-[10px] text-muted-foreground truncate">
            {startTime && <span className="font-medium shrink-0">{startTime}</span>}
            <span className="truncate">{event.summary || 'Untitled'}</span>
          </div>
        ) : (
          <>
            <div className="text-[10px] text-muted-foreground truncate">
              {startTime && endTime ? `${startTime} – ${endTime}` : startTime}
            </div>
            <div className="text-[11px] font-medium text-foreground truncate leading-tight">
              {event.summary || 'Untitled'}
            </div>
            {position.height >= 52 && event.location && (
              <div className="text-[10px] text-muted-foreground truncate">
                {event.location}
              </div>
            )}
          </>
        )}
      </div>
    </button>
  )
}

function CurrentTimeIndicator() {
  const now = new Date()
  const minutes = now.getHours() * 60 + now.getMinutes()
  const top = (minutes / 60) * HOUR_HEIGHT

  return (
    <div
      className="pointer-events-none absolute left-0 right-0 z-10"
      style={{ top }}
    >
      <div className="relative">
        <div className="absolute -left-1.5 -top-1.5 h-3 w-3 rounded-full bg-red-500" />
        <div className="h-px bg-red-500" />
      </div>
    </div>
  )
}

function formatHour(hour: number): string {
  if (hour === 0) return '12 AM'
  if (hour < 12) return `${hour} AM`
  if (hour === 12) return '12 PM'
  return `${hour - 12} PM`
}
