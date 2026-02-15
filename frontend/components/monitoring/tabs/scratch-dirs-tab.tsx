import { useState, useMemo } from 'react'
import { Link } from '@tanstack/react-router'
import { useTranslation } from 'react-i18next'
import { HugeiconsIcon } from '@hugeicons/react'
import {
  Cancel01Icon,
  Loading03Icon,
  Delete02Icon,
  Folder01Icon,
  Calendar03Icon,
  HardDriveIcon,
  ArrowRight01Icon,
  CleanIcon,
  PinIcon,
  PinOffIcon,
} from '@hugeicons/core-free-icons'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Checkbox } from '@/components/ui/checkbox'
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog'
import { useScratchDirs, useDeleteScratchDir, usePinScratchDir } from '@/hooks/use-scratch-dirs'
import { cn } from '@/lib/utils'
import type { ScratchDir, TaskStatus } from '@/types'

type StatusFilter = TaskStatus | 'ORPHANED'

const STATUS_BADGE_COLORS: Record<StatusFilter, string> = {
  TO_DO: 'bg-muted/50 text-muted-foreground',
  IN_PROGRESS: 'bg-muted-foreground/20 text-muted-foreground',
  IN_REVIEW: 'bg-primary/20 text-primary',
  DONE: 'bg-accent/20 text-accent',
  CANCELED: 'bg-destructive/20 text-destructive',
  ORPHANED: 'bg-destructive/20 text-destructive',
}

const ALL_STATUSES: StatusFilter[] = ['TO_DO', 'IN_PROGRESS', 'IN_REVIEW', 'DONE', 'CANCELED', 'ORPHANED']

function useFormatRelativeTime() {
  const { t } = useTranslation('common')

  return (isoDate: string): string => {
    const date = new Date(isoDate)
    const now = new Date()
    const diffMs = now.getTime() - date.getTime()
    const diffSecs = Math.floor(diffMs / 1000)
    const diffMins = Math.floor(diffSecs / 60)
    const diffHours = Math.floor(diffMins / 60)
    const diffDays = Math.floor(diffHours / 24)

    if (diffDays > 0) {
      return diffDays === 1 ? t('time.dayAgo') : t('time.daysAgo', { count: diffDays })
    }
    if (diffHours > 0) {
      return diffHours === 1 ? t('time.hourAgo') : t('time.hoursAgo', { count: diffHours })
    }
    if (diffMins > 0) {
      return diffMins === 1 ? t('time.minuteAgo') : t('time.minutesAgo', { count: diffMins })
    }
    return t('time.justNow')
  }
}

export default function ScratchDirsTab() {
  const { t } = useTranslation('common')
  const { t: ts } = useTranslation('scratch')
  const formatRelativeTime = useFormatRelativeTime()
  const { dirs, summary, isLoading, isLoadingDetails, error, refetch } = useScratchDirs()
  const deleteDir = useDeleteScratchDir()
  const pinDir = usePinScratchDir()
  const [selectedStatuses, setSelectedStatuses] = useState<Set<StatusFilter>>(new Set())
  const [bulkDeleteDialogOpen, setBulkDeleteDialogOpen] = useState(false)
  const [isBulkDeleting, setIsBulkDeleting] = useState(false)
  const [bulkDeleteLinkedTasks, setBulkDeleteLinkedTasks] = useState(false)
  const [deletingPath, setDeletingPath] = useState<string | null>(null)
  const [pinningPath, setPinningPath] = useState<string | null>(null)
  const [deleteDialogDir, setDeleteDialogDir] = useState<ScratchDir | null>(null)
  const [deleteLinkedTask, setDeleteLinkedTask] = useState(false)

  const toggleStatus = (status: StatusFilter) => {
    setSelectedStatuses((prev) => {
      const next = new Set(prev)
      if (next.has(status)) {
        next.delete(status)
      } else {
        next.add(status)
      }
      return next
    })
  }

  const clearFilters = () => {
    setSelectedStatuses(new Set())
  }

  const filteredDirs = useMemo(() => {
    if (selectedStatuses.size === 0) return dirs
    return dirs.filter((d) => {
      if (d.isOrphaned && selectedStatuses.has('ORPHANED')) return true
      if (d.taskStatus && selectedStatuses.has(d.taskStatus)) return true
      return false
    })
  }, [dirs, selectedStatuses])

  const completedDirs = useMemo(() => {
    return dirs.filter((d) => d.taskStatus === 'DONE' || d.taskStatus === 'CANCELED')
  }, [dirs])

  // Dirs eligible for bulk cleanup (completed and not pinned)
  const deletableDirs = useMemo(() => {
    return completedDirs.filter((d) => !d.pinned)
  }, [completedDirs])

  // Pinned completed dirs (will be skipped during cleanup)
  const pinnedCompletedDirs = useMemo(() => {
    return completedDirs.filter((d) => d.pinned)
  }, [completedDirs])

  const handleBulkDelete = async () => {
    if (deletableDirs.length === 0) return
    setIsBulkDeleting(true)
    try {
      for (const dir of deletableDirs) {
        await deleteDir.mutateAsync({
          dirPath: dir.path,
          deleteLinkedTask: bulkDeleteLinkedTasks,
        })
      }
      setBulkDeleteDialogOpen(false)
      refetch()
    } catch {
      // Keep dialog open on error
    } finally {
      setIsBulkDeleting(false)
    }
  }

  const handleTogglePin = async (dir: ScratchDir) => {
    if (!dir.taskId) return
    setPinningPath(dir.path)
    try {
      await pinDir.mutateAsync({
        taskId: dir.taskId,
        pinned: !dir.pinned,
      })
      refetch()
    } finally {
      setPinningPath(null)
    }
  }

  const handleDelete = async (dir: ScratchDir, shouldDeleteLinkedTask: boolean) => {
    setDeletingPath(dir.path)
    try {
      await deleteDir.mutateAsync({
        dirPath: dir.path,
        deleteLinkedTask: shouldDeleteLinkedTask,
      })
      setDeleteDialogDir(null)
      refetch()
    } catch {
      // Keep dialog open on error
    } finally {
      setDeletingPath(null)
    }
  }

  const handleDeleteDialogChange = (open: boolean) => {
    if (!open) {
      setDeleteDialogDir(null)
      setDeleteLinkedTask(false)
    }
  }

  const handleBulkDeleteDialogChange = (open: boolean) => {
    setBulkDeleteDialogOpen(open)
    if (!open) {
      setBulkDeleteLinkedTasks(false)
    }
  }

  return (
    <div className="space-y-4">
      {/* Summary and actions */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-3 text-sm text-muted-foreground">
          {(summary || dirs.length > 0) && (
            <>
              <span>{ts('summary.total', { count: summary?.total ?? dirs.length })}</span>
              {(summary?.orphaned ?? dirs.filter((d) => d.isOrphaned).length) > 0 && (
                <span className="text-destructive">
                  {ts('summary.orphaned', { count: summary?.orphaned ?? dirs.filter((d) => d.isOrphaned).length })}
                </span>
              )}
              {isLoadingDetails ? (
                <span className="animate-pulse">{t('status.calculating')}</span>
              ) : summary ? (
                <span>{summary.totalSizeFormatted}</span>
              ) : null}
            </>
          )}
        </div>
        <div className="flex items-center gap-2">
          {deletableDirs.length > 0 && (
            <AlertDialog open={bulkDeleteDialogOpen} onOpenChange={handleBulkDeleteDialogChange}>
              <AlertDialogTrigger
                render={
                  <Button
                    variant="ghost"
                    size="sm"
                    className="gap-1.5 text-xs text-muted-foreground hover:text-destructive"
                    disabled={isLoadingDetails}
                  />
                }
              >
                <HugeiconsIcon icon={CleanIcon} size={12} strokeWidth={2} />
                {ts('cleanup.button', { count: deletableDirs.length })}
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>{ts('cleanup.title')}</AlertDialogTitle>
                  <AlertDialogDescription>
                    {ts('cleanup.description', { count: deletableDirs.length })}
                    {bulkDeleteLinkedTasks && ` ${ts('cleanup.linkedTasksWillBeDeleted')}`}
                  </AlertDialogDescription>
                  <div className="space-y-3">
                    {pinnedCompletedDirs.length > 0 && (
                      <p className="flex items-center gap-1.5 text-sm text-muted-foreground">
                        <HugeiconsIcon icon={PinIcon} size={12} strokeWidth={2} />
                        {ts('cleanup.pinnedSkipped', { count: pinnedCompletedDirs.length })}
                      </p>
                    )}
                    <label className="flex items-center gap-2 text-sm text-foreground">
                      <Checkbox
                        checked={bulkDeleteLinkedTasks}
                        onCheckedChange={(checked) => setBulkDeleteLinkedTasks(checked === true)}
                        disabled={isBulkDeleting}
                      />
                      {ts('cleanup.alsoDeleteLinkedTasks')}
                    </label>
                    <p className="font-medium text-destructive text-xs">
                      {ts('cleanup.cannotUndo')}
                    </p>
                  </div>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel disabled={isBulkDeleting}>{t('buttons.cancel')}</AlertDialogCancel>
                  <Button
                    variant="destructive"
                    onClick={handleBulkDelete}
                    disabled={isBulkDeleting}
                    className="gap-2"
                  >
                    {isBulkDeleting && (
                      <HugeiconsIcon icon={Loading03Icon} size={14} strokeWidth={2} className="animate-spin" />
                    )}
                    {isBulkDeleting ? t('status.deleting') : ts('delete.button', { count: deletableDirs.length })}
                  </Button>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          )}
          {selectedStatuses.size > 0 && (
            <Button variant="ghost" size="sm" onClick={clearFilters} className="gap-1.5 text-xs">
              <HugeiconsIcon icon={Cancel01Icon} size={12} strokeWidth={2} />
              {t('buttons.clearFilters')}
            </Button>
          )}
        </div>
      </div>

      {/* Status filter chips */}
      <div className="flex flex-wrap items-center gap-1.5">
        {ALL_STATUSES.map((status) => {
          const isSelected = selectedStatuses.has(status)
          return (
            <button
              key={status}
              onClick={() => toggleStatus(status)}
              className={cn(
                'rounded-full px-2.5 py-1 text-xs font-medium transition-colors',
                isSelected
                  ? STATUS_BADGE_COLORS[status]
                  : 'bg-muted text-muted-foreground hover:bg-muted/80'
              )}
            >
              {t(`statuses.${status}`)}
            </button>
          )
        })}
      </div>

      {isLoading && (
        <div className="flex items-center justify-center py-12">
          <HugeiconsIcon icon={Loading03Icon} className="size-6 animate-spin text-muted-foreground" />
        </div>
      )}

      {error && (
        <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-4 text-sm text-destructive">
          {ts('error.failedToLoad', { message: error.message })}
        </div>
      )}

      {!isLoading && !error && filteredDirs.length === 0 && (
        <div className="py-12 text-center text-muted-foreground">
          {selectedStatuses.size > 0 ? ts('empty.noMatch') : ts('empty.noDirs')}
        </div>
      )}

      {!isLoading && filteredDirs.length > 0 && (
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 xl:grid-cols-3">
          {filteredDirs.map((dir) => {
            const isLoadingSize = dir.sizeFormatted === '...'
            const hasLinkedTask = !dir.isOrphaned && dir.taskId
            const isDeleting = deletingPath === dir.path

            return (
              <Card key={dir.path} className="transition-colors hover:border-border/80">
                <CardContent className="flex items-start justify-between gap-4 py-4">
                  <div className="min-w-0 flex-1 space-y-2">
                    <div className="flex items-center gap-2">
                      <span className="truncate font-medium">{dir.name}</span>
                      {dir.isOrphaned ? (
                        <Badge className={cn('shrink-0', STATUS_BADGE_COLORS.ORPHANED)}>
                          {t('statuses.ORPHANED')}
                        </Badge>
                      ) : dir.taskStatus ? (
                        <Badge className={cn('shrink-0', STATUS_BADGE_COLORS[dir.taskStatus])}>
                          {t(`statuses.${dir.taskStatus}`)}
                        </Badge>
                      ) : null}
                    </div>

                    <div className="space-y-1 text-xs text-muted-foreground">
                      <div className="flex items-center gap-1.5">
                        <HugeiconsIcon icon={Folder01Icon} size={12} strokeWidth={2} className="shrink-0" />
                        <span className="truncate font-mono">{dir.path}</span>
                      </div>

                      <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
                        <div className="flex items-center gap-1.5">
                          <HugeiconsIcon icon={HardDriveIcon} size={12} strokeWidth={2} className="shrink-0" />
                          {isLoadingSize ? (
                            <span className="inline-block animate-pulse rounded bg-muted h-3 w-12" />
                          ) : (
                            <span>{dir.sizeFormatted}</span>
                          )}
                        </div>

                        <div className="flex items-center gap-1.5">
                          <HugeiconsIcon icon={Calendar03Icon} size={12} strokeWidth={2} className="shrink-0" />
                          <span>{formatRelativeTime(dir.lastModified)}</span>
                        </div>
                      </div>

                      {dir.taskId && dir.taskTitle && (
                        <div className="flex items-center gap-1.5 pt-1">
                          <Link
                            to="/tasks/$taskId"
                            params={{ taskId: dir.taskId }}
                            className="inline-flex items-center gap-1 text-foreground hover:underline"
                          >
                            <span className="truncate">{dir.taskTitle}</span>
                            <HugeiconsIcon icon={ArrowRight01Icon} size={12} strokeWidth={2} className="shrink-0" />
                          </Link>
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="flex shrink-0 items-center gap-1">
                    {hasLinkedTask && (
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        className={cn(
                          'text-muted-foreground',
                          dir.pinned ? 'text-primary hover:text-primary/80' : 'hover:text-foreground'
                        )}
                        disabled={isLoadingSize || pinningPath === dir.path}
                        onClick={() => handleTogglePin(dir)}
                        title={dir.pinned ? ts('pin.unpin') : ts('pin.pin')}
                      >
                        {pinningPath === dir.path ? (
                          <HugeiconsIcon icon={Loading03Icon} size={14} strokeWidth={2} className="animate-spin" />
                        ) : (
                          <HugeiconsIcon icon={dir.pinned ? PinIcon : PinOffIcon} size={14} strokeWidth={dir.pinned ? 3 : 2} />
                        )}
                      </Button>
                    )}
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      className="text-muted-foreground hover:text-destructive disabled:opacity-50"
                      disabled={isLoadingSize || isDeleting || dir.pinned}
                      onClick={() => setDeleteDialogDir(dir)}
                      title={dir.pinned ? ts('delete.unpinFirst') : ts('delete.title')}
                    >
                      <HugeiconsIcon
                        icon={isDeleting ? Loading03Icon : Delete02Icon}
                        size={14}
                        strokeWidth={2}
                        className={isDeleting ? 'animate-spin' : ''}
                      />
                    </Button>
                    <AlertDialog
                      open={deleteDialogDir?.path === dir.path}
                      onOpenChange={handleDeleteDialogChange}
                    >
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>{ts('delete.title')}</AlertDialogTitle>
                          <AlertDialogDescription>
                            {ts('delete.description')}{' '}
                            <span className="font-mono">{dir.name}</span>.
                            {deleteLinkedTask && hasLinkedTask && (
                              <>
                                {' '}
                                {ts('delete.linkedTaskWillBeDeleted', { title: dir.taskTitle })}
                              </>
                            )}{' '}
                            {ts('delete.cannotUndo')}
                          </AlertDialogDescription>
                          {hasLinkedTask && (
                            <label className="flex items-center gap-2 text-sm text-foreground">
                              <Checkbox
                                checked={deleteLinkedTask}
                                onCheckedChange={(checked) => setDeleteLinkedTask(checked === true)}
                                disabled={isDeleting}
                              />
                              {ts('delete.alsoDeleteLinkedTask', { title: dir.taskTitle })}
                            </label>
                          )}
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel disabled={isDeleting}>{t('buttons.cancel')}</AlertDialogCancel>
                          <Button
                            variant="destructive"
                            onClick={() => handleDelete(dir, deleteLinkedTask)}
                            disabled={isDeleting}
                            className="gap-2"
                          >
                            {isDeleting && (
                              <HugeiconsIcon icon={Loading03Icon} size={14} strokeWidth={2} className="animate-spin" />
                            )}
                            {isDeleting ? t('status.deleting') : t('buttons.delete')}
                          </Button>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </div>
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}
    </div>
  )
}
