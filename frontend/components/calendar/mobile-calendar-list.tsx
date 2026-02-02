import { useMemo, useState, useCallback } from 'react'
import { useNavigate } from '@tanstack/react-router'
import { useTasks } from '@/hooks/use-tasks'
import { useProjects } from '@/hooks/use-projects'
import { useToday } from '@/hooks/use-date-utils'
import { useCaldavEvents, useCaldavCalendars } from '@/hooks/use-caldav'
import type { CaldavEvent } from '@/hooks/use-caldav'
import type { Task, TaskStatus } from '@/types'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { HugeiconsIcon } from '@hugeicons/react'
import { ArrowLeft01Icon, ArrowRight01Icon, Calendar03Icon } from '@hugeicons/core-free-icons'
import { NonWorktreeTaskModal } from '@/components/task/non-worktree-task-modal'

const STATUS_ORDER: Record<TaskStatus, number> = {
  IN_REVIEW: 0,
  IN_PROGRESS: 1,
  TO_DO: 2,
  DONE: 3,
  CANCELED: 4,
}

const STATUS_LABELS: Record<TaskStatus, string> = {
  TO_DO: 'To Do',
  IN_PROGRESS: 'In Progress',
  IN_REVIEW: 'Review',
  DONE: 'Done',
  CANCELED: 'Canceled',
}

interface MobileCalendarListProps {
  className?: string
  projectFilter?: string | null
  tagsFilter?: string[]
}

type ListItem =
  | { type: 'task'; task: Task }
  | { type: 'event'; event: CaldavEvent; calendarColor?: string }

export function MobileCalendarList({ className, projectFilter, tagsFilter }: MobileCalendarListProps) {
  const navigate = useNavigate()
  const { data: tasks = [] } = useTasks()
  const { data: projects = [] } = useProjects()
  const todayString = useToday()
  const [currentDate, setCurrentDate] = useState(() => new Date())
  const [showOverdue, setShowOverdue] = useState(true)
  const [selectedTask, setSelectedTask] = useState<Task | null>(null)
  const [modalOpen, setModalOpen] = useState(false)

  // Project filter helpers
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

  const taskMatchesProjectFilter = useCallback(
    (task: Task): boolean => {
      if (!projectFilter) return true
      if (projectFilter === 'inbox') {
        return (
          !task.projectId &&
          (!task.repositoryId || !projectRepoIds.has(task.repositoryId)) &&
          (!task.repoPath || !projectRepoPaths.has(task.repoPath))
        )
      }
      if (task.projectId === projectFilter) return true
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

  const taskMatchesTagsFilter = useCallback(
    (task: Task): boolean => {
      if (!tagsFilter || tagsFilter.length === 0) return true
      return task.tags.some((tag) => tagsFilter.includes(tag))
    },
    [tagsFilter]
  )

  // Date range for the current month
  const dateRange = useMemo(() => {
    const year = currentDate.getFullYear()
    const month = currentDate.getMonth()
    const first = new Date(year, month, 1)
    const last = new Date(year, month + 1, 0)
    return {
      from: first.toISOString().split('T')[0],
      to: last.toISOString().split('T')[0],
    }
  }, [currentDate])

  const { data: caldavEvents = [] } = useCaldavEvents(dateRange.from, dateRange.to)
  const { data: caldavCalendars = [] } = useCaldavCalendars()

  const calendarColorMap = useMemo(() => {
    const map = new Map<string, string>()
    for (const cal of caldavCalendars) {
      if (cal.color) map.set(cal.id, cal.color)
    }
    return map
  }, [caldavCalendars])

  // Filter active tasks
  const activeTasks = useMemo(() => {
    return tasks.filter(
      (t) =>
        t.status !== 'DONE' &&
        t.status !== 'CANCELED' &&
        taskMatchesProjectFilter(t) &&
        taskMatchesTagsFilter(t)
    )
  }, [tasks, taskMatchesProjectFilter, taskMatchesTagsFilter])

  // Group items by date
  const { overdueTasks, dateGroups, noDueDateTasks } = useMemo(() => {
    const overdue: Task[] = []
    const noDueDate: Task[] = []
    const byDate = new Map<string, ListItem[]>()

    for (const task of activeTasks) {
      if (!task.dueDate) {
        noDueDate.push(task)
        continue
      }
      const dateKey = task.dueDate.split('T')[0]
      if (dateKey < todayString) {
        overdue.push(task)
      } else {
        if (!byDate.has(dateKey)) byDate.set(dateKey, [])
        byDate.get(dateKey)!.push({ type: 'task', task })
      }
    }

    // Add events to date groups
    for (const event of caldavEvents) {
      if (!event.dtstart) continue
      const dateKey = event.dtstart.split('T')[0]

      if (event.allDay && event.dtend) {
        const endDate = event.dtend.split('T')[0]
        const cur = new Date(dateKey + 'T00:00:00')
        const end = new Date(endDate + 'T00:00:00')
        while (cur < end) {
          const key = cur.toISOString().split('T')[0]
          if (!byDate.has(key)) byDate.set(key, [])
          byDate.get(key)!.push({ type: 'event', event, calendarColor: calendarColorMap.get(event.calendarId) })
          cur.setDate(cur.getDate() + 1)
        }
      } else {
        if (!byDate.has(dateKey)) byDate.set(dateKey, [])
        byDate.get(dateKey)!.push({ type: 'event', event, calendarColor: calendarColorMap.get(event.calendarId) })
      }
    }

    // Sort overdue by date descending (most recent first), then status
    overdue.sort((a, b) => {
      const dateDiff = b.dueDate!.localeCompare(a.dueDate!)
      if (dateDiff !== 0) return dateDiff
      return STATUS_ORDER[a.status] - STATUS_ORDER[b.status]
    })

    // Sort no-due-date by status priority, then updated
    noDueDate.sort((a, b) => {
      const statusDiff = STATUS_ORDER[a.status] - STATUS_ORDER[b.status]
      if (statusDiff !== 0) return statusDiff
      return b.updatedAt.localeCompare(a.updatedAt)
    })

    // Sort items within each date group: tasks by status, events by time
    const sortedGroups: { dateKey: string; items: ListItem[] }[] = []
    const sortedKeys = [...byDate.keys()].sort()

    for (const dateKey of sortedKeys) {
      const items = byDate.get(dateKey)!
      items.sort((a, b) => {
        // Tasks before events
        if (a.type === 'task' && b.type === 'event') return -1
        if (a.type === 'event' && b.type === 'task') return 1
        // Tasks: sort by status
        if (a.type === 'task' && b.type === 'task') {
          return STATUS_ORDER[a.task.status] - STATUS_ORDER[b.task.status]
        }
        // Events: sort by time
        if (a.type === 'event' && b.type === 'event') {
          const aTime = a.event.dtstart || ''
          const bTime = b.event.dtstart || ''
          return aTime.localeCompare(bTime)
        }
        return 0
      })
      sortedGroups.push({ dateKey, items })
    }

    return { overdueTasks: overdue, dateGroups: sortedGroups, noDueDateTasks: noDueDate }
  }, [activeTasks, caldavEvents, todayString, calendarColorMap])

  const handleTaskClick = (task: Task) => {
    if (task.worktreePath) {
      navigate({ to: '/tasks/$taskId', params: { taskId: task.id } })
    } else {
      setSelectedTask(task)
      setModalOpen(true)
    }
  }

  const goToPrevMonth = () => {
    setCurrentDate((prev) => new Date(prev.getFullYear(), prev.getMonth() - 1, 1))
  }

  const goToNextMonth = () => {
    setCurrentDate((prev) => new Date(prev.getFullYear(), prev.getMonth() + 1, 1))
  }

  const goToToday = () => {
    setCurrentDate(new Date())
  }

  const monthYear = currentDate.toLocaleDateString('en-US', {
    month: 'long',
    year: 'numeric',
  })

  return (
    <div className={cn('flex h-full flex-col', className)}>
      {/* Header */}
      <div className="flex items-center gap-3 border-b px-4 py-2">
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
        {overdueTasks.length > 0 && (
          <label className="flex items-center gap-1.5 cursor-pointer">
            <Checkbox
              checked={showOverdue}
              onCheckedChange={(checked) => setShowOverdue(checked === true)}
              className="h-3.5 w-3.5"
            />
            <span className="text-xs text-muted-foreground">Overdue</span>
          </label>
        )}
        <div className="flex-1" />
        <h2 className="text-lg font-semibold">{monthYear}</h2>
      </div>

      {/* List */}
      <div className="flex-1 overflow-auto">
        <div className="p-4 space-y-4">
          {/* Overdue section */}
          {showOverdue && overdueTasks.length > 0 && (
            <div>
              <h3 className="text-xs font-semibold text-red-500 uppercase tracking-wide mb-2">Overdue</h3>
              <div className="space-y-1">
                {overdueTasks.map((task) => (
                  <TaskItem
                    key={task.id}
                    task={task}
                    todayString={todayString}
                    onClick={handleTaskClick}
                  />
                ))}
              </div>
            </div>
          )}

          {/* Date groups */}
          {dateGroups.map(({ dateKey, items }) => (
            <div key={dateKey}>
              <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">
                {formatDateHeader(dateKey, todayString)}
              </h3>
              <div className="space-y-1">
                {items.map((item) =>
                  item.type === 'task' ? (
                    <TaskItem
                      key={item.task.id}
                      task={item.task}
                      todayString={todayString}
                      onClick={handleTaskClick}
                    />
                  ) : (
                    <EventItem
                      key={item.event.id}
                      event={item.event}
                      calendarColor={item.calendarColor}
                    />
                  )
                )}
              </div>
            </div>
          ))}

          {/* No due date */}
          {noDueDateTasks.length > 0 && (
            <div>
              <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">
                No due date
              </h3>
              <div className="space-y-1">
                {noDueDateTasks.map((task) => (
                  <TaskItem
                    key={task.id}
                    task={task}
                    todayString={todayString}
                    onClick={handleTaskClick}
                  />
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Task modal */}
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
    </div>
  )
}

function TaskItem({
  task,
  todayString,
  onClick,
}: {
  task: Task
  todayString: string
  onClick: (task: Task) => void
}) {
  const dueDateStr = task.dueDate?.split('T')[0]
  const isOverdue =
    dueDateStr &&
    dueDateStr < todayString &&
    task.status !== 'DONE' &&
    task.status !== 'CANCELED'
  const isToday = dueDateStr === todayString
  const tomorrow = new Date(todayString + 'T00:00:00')
  tomorrow.setDate(tomorrow.getDate() + 1)
  const tomorrowString = tomorrow.toISOString().split('T')[0]
  const isTomorrow = dueDateStr === tomorrowString

  return (
    <button
      onClick={() => onClick(task)}
      className="w-full text-left rounded-lg border border-border bg-background px-3 py-2 transition-colors hover:bg-accent/50 cursor-pointer"
    >
      <div className="flex items-center gap-2 min-w-0">
        <span
          className="shrink-0 h-2 w-2 rounded-full"
          style={{ backgroundColor: `var(--status-${task.status.toLowerCase().replace('_', '-')})` }}
        />
        <span className="flex-1 truncate text-sm text-foreground">{task.title}</span>
      </div>
      <div className="flex items-center gap-2 mt-0.5 pl-4">
        {task.dueDate ? (
          <span
            className={cn(
              'text-xs',
              isOverdue
                ? 'text-red-500 font-medium'
                : isToday
                  ? 'text-orange-500 font-medium'
                  : isTomorrow
                    ? 'text-yellow-500'
                    : 'text-muted-foreground'
            )}
          >
            {formatDueDate(task.dueDate, todayString)}
          </span>
        ) : (
          <span className="text-xs text-muted-foreground/50">No due date</span>
        )}
        <span className="text-xs text-muted-foreground ml-auto">
          {STATUS_LABELS[task.status]}
        </span>
      </div>
    </button>
  )
}

function EventItem({
  event,
  calendarColor,
}: {
  event: CaldavEvent
  calendarColor?: string
}) {
  const timeStr = event.allDay
    ? null
    : event.dtstart?.split('T')[1]?.slice(0, 5)

  return (
    <div className="rounded-lg border border-border bg-background px-3 py-2">
      <div className="flex items-center gap-2 min-w-0">
        <HugeiconsIcon
          icon={Calendar03Icon}
          size={10}
          className="shrink-0 text-muted-foreground"
          style={calendarColor ? { color: calendarColor } : undefined}
        />
        <span className="flex-1 truncate text-sm text-foreground">
          {timeStr && <span className="text-muted-foreground mr-1.5">{timeStr}</span>}
          {event.summary || 'Untitled event'}
        </span>
      </div>
      <div className="flex items-center gap-2 mt-0.5 pl-4">
        <span className="text-xs text-muted-foreground">Calendar event</span>
      </div>
    </div>
  )
}

function formatDateHeader(dateKey: string, today: string): string {
  const date = new Date(dateKey + 'T00:00:00')
  const dayName = date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })

  if (dateKey === today) return `Today · ${dayName}`

  const todayDate = new Date(today + 'T00:00:00')
  const diffDays = Math.round((date.getTime() - todayDate.getTime()) / (1000 * 60 * 60 * 24))
  if (diffDays === 1) return `Tomorrow · ${dayName}`

  return dayName
}

function formatDueDate(dueDate: string, today: string): string {
  const due = dueDate.split('T')[0]
  if (due === today) return 'Today'

  const todayDate = new Date(today + 'T00:00:00')
  const dueObj = new Date(due + 'T00:00:00')
  const diffDays = Math.round((dueObj.getTime() - todayDate.getTime()) / (1000 * 60 * 60 * 24))

  if (diffDays === 1) return 'Tomorrow'
  if (diffDays === -1) return 'Yesterday'
  if (diffDays > 1 && diffDays <= 7) return `In ${diffDays} days`
  if (diffDays < -1 && diffDays >= -7) return `${Math.abs(diffDays)} days ago`

  return dueObj.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}
