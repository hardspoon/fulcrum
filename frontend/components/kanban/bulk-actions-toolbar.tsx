import { useState, useMemo } from 'react'
import { HugeiconsIcon } from '@hugeicons/react'
import { PinIcon } from '@hugeicons/core-free-icons'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { useSelection } from './selection-context'
import { useBulkDeleteTasks, useTasks } from '@/hooks/use-tasks'
import { cn } from '@/lib/utils'

export function BulkActionsToolbar() {
  const { selectedIds, clearSelection } = useSelection()
  const bulkDelete = useBulkDeleteTasks()
  const { data: tasks = [] } = useTasks()
  const [deleteLinkedWorktrees, setDeleteLinkedWorktrees] = useState(true)

  const count = selectedIds.size

  // Count how many selected tasks are pinned vs unpinned with worktrees
  const { pinnedCount, unpinnedWithWorktreeCount } = useMemo(() => {
    const selectedTasks = tasks.filter(t => selectedIds.has(t.id))
    return {
      pinnedCount: selectedTasks.filter(t => t.pinned).length,
      unpinnedWithWorktreeCount: selectedTasks.filter(t => !t.pinned && t.worktreePath).length,
    }
  }, [tasks, selectedIds])

  // Only show checkbox if there are unpinned tasks with worktrees
  const showWorktreeCheckbox = unpinnedWithWorktreeCount > 0

  const handleDelete = () => {
    bulkDelete.mutate(
      { ids: Array.from(selectedIds), deleteLinkedWorktrees },
      {
        onSuccess: () => {
          clearSelection()
        },
      }
    )
  }

  if (count === 0) return null

  return (
    <div
      className={cn(
        'fixed inset-x-0 bottom-0 z-40 border-t bg-background/95 backdrop-blur-sm',
        'animate-in slide-in-from-bottom-2 duration-200'
      )}
    >
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-3">
        <span className="text-sm text-muted-foreground">
          {count} task{count !== 1 ? 's' : ''} selected
        </span>
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" onClick={clearSelection}>
            Clear
          </Button>
          <AlertDialog>
            <AlertDialogTrigger
              render={
                <Button
                  variant="destructive"
                  size="sm"
                  disabled={bulkDelete.isPending}
                />
              }
            >
              {bulkDelete.isPending ? 'Deleting...' : 'Delete'}
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Delete {count} Task{count !== 1 ? 's' : ''}</AlertDialogTitle>
                <AlertDialogDescription>
                  This will permanently delete {count} task{count !== 1 ? 's' : ''}. This action cannot be undone.
                </AlertDialogDescription>
                {pinnedCount > 0 && (
                  <p className="flex items-center gap-1.5 text-sm text-primary">
                    <HugeiconsIcon icon={PinIcon} size={14} strokeWidth={2} />
                    {pinnedCount} pinned worktree{pinnedCount !== 1 ? 's' : ''} will be preserved
                  </p>
                )}
              </AlertDialogHeader>
              {showWorktreeCheckbox && (
                <div className="flex items-center gap-2 py-2">
                  <Checkbox
                    id="bulk-delete-worktrees"
                    checked={deleteLinkedWorktrees}
                    onCheckedChange={(checked) => setDeleteLinkedWorktrees(checked === true)}
                  />
                  <label htmlFor="bulk-delete-worktrees" className="cursor-pointer text-sm">
                    Also delete linked worktrees
                  </label>
                </div>
              )}
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction
                  onClick={handleDelete}
                  variant="destructive"
                  disabled={bulkDelete.isPending}
                >
                  {bulkDelete.isPending ? 'Deleting...' : 'Delete'}
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </div>
    </div>
  )
}
