import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { useState, useMemo, useCallback } from 'react'
import { TaskCalendar } from '@/components/calendar/task-calendar'
import { TaskListSidebar } from '@/components/calendar/task-list-sidebar'
import { MobileCalendarList } from '@/components/calendar/mobile-calendar-list'
import { NonWorktreeTaskModal } from '@/components/task/non-worktree-task-modal'
import { TagsFilter } from '@/components/tasks/tags-filter'
import { ProjectFilter } from '@/components/tasks/project-filter'
import type { Task } from '@/types'

interface CalendarSearch {
  project?: string
  tags?: string
}

export const Route = createFileRoute('/calendar/')({
  component: CalendarView,
  validateSearch: (search: Record<string, unknown>): CalendarSearch => ({
    project: typeof search.project === 'string' ? search.project : undefined,
    tags: typeof search.tags === 'string' ? search.tags : undefined,
  }),
})

function CalendarView() {
  const { project: projectFilter, tags: tagsParam } = Route.useSearch()
  const navigate = useNavigate()
  const [selectedTask, setSelectedTask] = useState<Task | null>(null)
  const [modalOpen, setModalOpen] = useState(false)

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

  const handleSidebarTaskClick = useCallback(
    (task: Task) => {
      if (task.worktreePath) {
        navigate({ to: '/tasks/$taskId', params: { taskId: task.id } })
      } else {
        setSelectedTask(task)
        setModalOpen(true)
      }
    },
    [navigate]
  )

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
          sidebar={(gridHeight) => (
            <div
              className="w-48 lg:w-64 xl:w-80 sticky top-0 self-start overflow-hidden"
              style={gridHeight ? { height: gridHeight } : undefined}
            >
              <TaskListSidebar
                projectFilter={projectFilter ?? null}
                tagsFilter={tagsFilter}
                onTaskClick={handleSidebarTaskClick}
              />
            </div>
          )}
        />
      </div>

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
