import { useState, useEffect } from 'react'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Checkbox } from '@/components/ui/checkbox'
import { useDeleteTask } from '@/hooks/use-tasks'
import type { Task } from '@/types'

interface DeleteTaskDialogProps {
  task: Task
  open?: boolean
  onOpenChange?: (open: boolean) => void
  onDeleted?: () => void
}

export function DeleteTaskDialog({
  task,
  open,
  onOpenChange,
  onDeleted,
}: DeleteTaskDialogProps) {
  const deleteTask = useDeleteTask()
  const [deleteLinkedWorktree, setDeleteLinkedWorktree] = useState(true)

  // Reset checkbox when dialog opens
  useEffect(() => {
    if (open) {
      setDeleteLinkedWorktree(true)
    }
  }, [open])

  const handleDelete = () => {
    deleteTask.mutate(
      { taskId: task.id, deleteLinkedWorktree },
      {
        onSuccess: () => {
          onOpenChange?.(false)
          onDeleted?.()
        },
      }
    )
  }

  const showWorktreeCheckbox = !!task.worktreePath

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Delete Task</AlertDialogTitle>
          <AlertDialogDescription>
            This will permanently delete "{task.title}" and close its terminal.
            {deleteLinkedWorktree && task.worktreePath && ' The linked worktree will also be removed.'}
            {' '}This action cannot be undone.
          </AlertDialogDescription>
        </AlertDialogHeader>
        {showWorktreeCheckbox && (
          <label className="flex items-center gap-2 py-2 text-sm text-foreground cursor-pointer">
            <Checkbox
              checked={deleteLinkedWorktree}
              onCheckedChange={(checked) => setDeleteLinkedWorktree(checked === true)}
              disabled={deleteTask.isPending}
            />
            Also delete linked worktree
          </label>
        )}
        <AlertDialogFooter>
          <AlertDialogCancel disabled={deleteTask.isPending}>Cancel</AlertDialogCancel>
          <AlertDialogAction
            onClick={handleDelete}
            variant="destructive"
            disabled={deleteTask.isPending}
          >
            {deleteTask.isPending ? 'Deleting...' : 'Delete'}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
