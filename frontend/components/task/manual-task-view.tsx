import { TaskContent } from '@/components/task/task-content'
import type { Task } from '@/types'

interface ManualTaskViewProps {
  task: Task
}

export function ManualTaskView({ task }: ManualTaskViewProps) {
  return (
    <div className="flex h-full min-h-0 flex-col">
      <TaskContent task={task} />
    </div>
  )
}
