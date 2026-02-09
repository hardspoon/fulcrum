import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { useMemo, useCallback } from 'react'
import { TaskCalendar } from '@/components/calendar/task-calendar'
import type { ViewMode } from '@/components/calendar/task-calendar'
import { TaskListSidebar } from '@/components/calendar/task-list-sidebar'
import { MobileCalendarList } from '@/components/calendar/mobile-calendar-list'
import { NonWorktreeTaskModal } from '@/components/task/non-worktree-task-modal'
import { TagsFilter } from '@/components/tasks/tags-filter'
import { ProjectFilter } from '@/components/tasks/project-filter'
import { useTasks } from '@/hooks/use-tasks'
import type { Task } from '@/types'

interface CalendarSearch {
  project?: string
  tags?: string
  calView?: 'month' | 'week'
  task?: string
}

export const Route = createFileRoute('/calendar/')({
  component: CalendarView,
  validateSearch: (search: Record<string, unknown>): CalendarSearch => ({
    project: typeof search.project === 'string' ? search.project : undefined,
    tags: typeof search.tags === 'string' ? search.tags : undefined,
    calView: search.calView === 'month' ? 'month' : undefined,
    task: typeof search.task === 'string' ? search.task : undefined,
  }),
})

function CalendarView() {
  const { project: projectFilter, tags: tagsParam, calView: viewParam, task: taskParam } = Route.useSearch()
  const navigate = useNavigate()
  const { data: tasks } = useTasks()

  const selectedTaskId = taskParam ?? null

  const viewMode: ViewMode = viewParam || 'week'

  const setViewMode = useCallback(
    (mode: ViewMode) => {
      navigate({
        to: '/calendar',
        search: (prev) => ({ ...prev, calView: mode === 'week' ? undefined : mode }),
        replace: true,
      })
    },
    [navigate]
  )

  const selectedTask = useMemo(
    () => (selectedTaskId ? tasks?.find((t) => t.id === selectedTaskId) ?? null : null),
    [selectedTaskId, tasks]
  )

  const tagsFilter = useMemo(() => {
    if (!tagsParam) return []
    return tagsParam.split(',').filter(Boolean)
  }, [tagsParam])

  const setProjectFilter = useCallback(
    (projectId: string | null) => {
      navigate({
        to: '/calendar',
        search: (prev) => ({ ...prev, project: projectId || undefined }),
        replace: true,
      })
    },
    [navigate]
  )

  const setTagsFilter = useCallback(
    (tags: string[]) => {
      navigate({
        to: '/calendar',
        search: (prev) => ({ ...prev, tags: tags.length > 0 ? tags.join(',') : undefined }),
        replace: true,
      })
    },
    [navigate]
  )

  const handleTaskClick = useCallback(
    (task: Task) => {
      if (task.worktreePath) {
        navigate({ to: '/tasks/$taskId', params: { taskId: task.id } })
      } else {
        navigate({
          to: '/calendar',
          search: (prev) => ({ ...prev, task: task.id }),
          replace: true,
        })
      }
    },
    [navigate]
  )

  const handleTaskModalClose = useCallback(() => {
    navigate({
      to: '/calendar',
      search: (prev) => {
        const { task: _, ...rest } = prev as CalendarSearch
        return rest
      },
      replace: true,
    })
  }, [navigate])

  return (
    <div className="flex h-full flex-col">
      <div className="film-grain relative flex shrink-0 items-center gap-2 border-b border-border px-4 py-2" style={{ background: 'var(--gradient-header)' }}>
        <div className="hidden sm:contents">
          <ProjectFilter value={projectFilter ?? null} onChange={setProjectFilter} />
          <TagsFilter value={tagsFilter} onChange={setTagsFilter} />
        </div>
        <div className="flex-1" />
      </div>

      {/* Mobile: list view */}
      <div className="flex-1 overflow-hidden md:hidden">
        <MobileCalendarList
          projectFilter={projectFilter ?? null}
          tagsFilter={tagsFilter}
        />
      </div>

      {/* Desktop: grid + sidebar */}
      <div className="hidden md:block flex-1 overflow-hidden">
        <TaskCalendar
          projectFilter={projectFilter ?? null}
          tagsFilter={tagsFilter}
          viewMode={viewMode}
          onViewModeChange={setViewMode}
          onTaskClick={handleTaskClick}
          sidebar={(gridHeight) => (
            <div
              className="w-48 lg:w-64 xl:w-80 sticky top-0 self-start overflow-hidden"
              style={gridHeight ? { height: gridHeight } : undefined}
            >
              <TaskListSidebar
                projectFilter={projectFilter ?? null}
                tagsFilter={tagsFilter}
                onTaskClick={handleTaskClick}
              />
            </div>
          )}
        />
      </div>

      {selectedTask && !selectedTask.worktreePath && (
        <NonWorktreeTaskModal
          task={selectedTask}
          open={true}
          onOpenChange={(open) => {
            if (!open) handleTaskModalClose()
          }}
        />
      )}
    </div>
  )
}
