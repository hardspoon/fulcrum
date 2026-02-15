import { getTaskType } from '../../shared/types'

type TaskLike = Parameters<typeof getTaskType>[0]

export function getTaskTypeCssVar(task: TaskLike): string {
  const type = getTaskType(task)
  return `var(--type-${type})`
}
