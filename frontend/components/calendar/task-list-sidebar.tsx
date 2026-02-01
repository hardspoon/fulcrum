import { useMemo, useCallback } from 'react'
import { useNavigate } from '@tanstack/react-router'
import { useTasks } from '@/hooks/use-tasks'
import { useProjects } from '@/hooks/use-projects'
import { useToday } from '@/hooks/use-date-utils'
import type { Task, TaskStatus } from '@/types'
import { cn } from '@/lib/utils'

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

interface TaskListSidebarProps {
  projectFilter?: string | null
  tagsFilter?: string[]
  onTaskClick?: (task: Task) => void
}

export function TaskListSidebar({ projectFilter, tagsFilter, onTaskClick }: TaskListSidebarProps) {
  const navigate = useNavigate()
  const { data: tasks = [] } = useTasks()
  const { data: projects = [] } = useProjects()
  const todayString = useToday()

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

  const sortedTasks = useMemo(() => {
    const active = tasks.filter(
      (t) =>
        t.status !== 'DONE' &&
        t.status !== 'CANCELED' &&
        taskMatchesProjectFilter(t) &&
        taskMatchesTagsFilter(t)
    )

    return active.sort((a, b) => {
      // Primary: tasks with due dates always before tasks without
      const aHasDue = !!a.dueDate
      const bHasDue = !!b.dueDate
      if (aHasDue && !bHasDue) return -1
      if (!aHasDue && bHasDue) return 1

      if (aHasDue && bHasDue) {
        // Both have due dates: sort by date ascending, then status
        const dateDiff = a.dueDate!.localeCompare(b.dueDate!)
        if (dateDiff !== 0) return dateDiff
        const statusDiff = STATUS_ORDER[a.status] - STATUS_ORDER[b.status]
        if (statusDiff !== 0) return statusDiff
      } else {
        // Neither has due date: sort by status priority
        const statusDiff = STATUS_ORDER[a.status] - STATUS_ORDER[b.status]
        if (statusDiff !== 0) return statusDiff
      }

      // Tertiary: most recently updated
      return b.updatedAt.localeCompare(a.updatedAt)
    })
  }, [tasks, taskMatchesProjectFilter, taskMatchesTagsFilter])

  const handleTaskClick = (task: Task) => {
    if (onTaskClick) {
      onTaskClick(task)
    } else if (task.worktreePath) {
      navigate({ to: '/tasks/$taskId', params: { taskId: task.id } })
    }
  }

  return (
    <div className="h-full overflow-y-auto rounded-lg border border-border bg-background">
        <div className="p-1.5">
          {sortedTasks.length === 0 ? (
            <div className="py-6 text-center text-xs text-muted-foreground">No active tasks</div>
          ) : (
            sortedTasks.map((task) => {
              const isOverdue =
                task.dueDate &&
                task.dueDate < todayString &&
                task.status !== 'DONE' &&
                task.status !== 'CANCELED'

              return (
                <button
                  key={task.id}
                  onClick={() => handleTaskClick(task)}
                  className="w-full text-left rounded-md px-2 py-1.5 transition-colors hover:bg-accent/50 cursor-pointer"
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <span
                      className="shrink-0 h-2 w-2 rounded-full"
                      style={{ backgroundColor: `var(--status-${task.status.toLowerCase().replace('_', '-')})` }}
                    />
                    <span className="flex-1 truncate text-xs text-foreground">{task.title}</span>
                  </div>
                  <div className="flex items-center gap-2 mt-0.5 pl-4">
                    {task.dueDate ? (
                      <span
                        className={cn(
                          'text-[10px]',
                          isOverdue ? 'text-red-500 font-medium' : 'text-muted-foreground'
                        )}
                      >
                        {formatDueDate(task.dueDate, todayString)}
                      </span>
                    ) : (
                      <span className="text-[10px] text-muted-foreground/50">No due date</span>
                    )}
                    <span className="text-[10px] text-muted-foreground ml-auto">
                      {STATUS_LABELS[task.status]}
                    </span>
                  </div>
                </button>
              )
            })
          )}
        </div>
    </div>
  )
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
