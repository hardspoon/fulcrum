import { useState, useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogClose,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Checkbox } from '@/components/ui/checkbox'
import { FilesystemBrowser } from '@/components/ui/filesystem-browser'
import { HugeiconsIcon } from '@hugeicons/react'
import {
  Loading03Icon,
  Folder01Icon,
  Alert02Icon,
  CheckmarkCircle02Icon,
  Search01Icon,
} from '@hugeicons/core-free-icons'
import { useDefaultGitReposDir } from '@/hooks/use-config'
import {
  useScanRepositories,
  useBulkCreateRepositories,
  type ScannedRepository,
} from '@/hooks/use-repositories'

interface BulkAddDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSuccess?: () => void
}

export function BulkAddDialog({
  open,
  onOpenChange,
  onSuccess,
}: BulkAddDialogProps) {
  const { t } = useTranslation('repositories')
  const [directory, setDirectory] = useState('')
  const [browserOpen, setBrowserOpen] = useState(false)
  const [scannedRepos, setScannedRepos] = useState<ScannedRepository[] | null>(null)
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [error, setError] = useState<string | null>(null)

  const { data: defaultGitReposDir } = useDefaultGitReposDir()
  const scanMutation = useScanRepositories()
  const bulkCreateMutation = useBulkCreateRepositories()

  // Use default dir if no directory entered
  const effectiveDirectory = directory.trim() || defaultGitReposDir || ''

  const isPending = scanMutation.isPending || bulkCreateMutation.isPending

  // Filter to only repos that can be added (not already existing)
  const addableRepos = useMemo(
    () => scannedRepos?.filter((r) => !r.exists) ?? [],
    [scannedRepos]
  )

  const handleScan = () => {
    setError(null)
    setScannedRepos(null)
    setSelected(new Set())

    scanMutation.mutate(effectiveDirectory || undefined, {
      onSuccess: (result) => {
        setScannedRepos(result.repositories)
        // Pre-select all addable repos
        const addable = result.repositories.filter((r) => !r.exists)
        setSelected(new Set(addable.map((r) => r.path)))
      },
      onError: (err) => {
        setError(err instanceof Error ? err.message : t('bulkAdd.scanFailed'))
      },
    })
  }

  const handleBrowseSelect = (path: string) => {
    setDirectory(path)
    setBrowserOpen(false)
    // Reset scan results when directory changes
    setScannedRepos(null)
    setSelected(new Set())
  }

  const handleToggle = (path: string) => {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(path)) {
        next.delete(path)
      } else {
        next.add(path)
      }
      return next
    })
  }

  const handleSelectAll = () => {
    setSelected(new Set(addableRepos.map((r) => r.path)))
  }

  const handleSelectNone = () => {
    setSelected(new Set())
  }

  const handleAdd = () => {
    if (selected.size === 0) return

    const repos = Array.from(selected).map((path) => {
      const repo = scannedRepos?.find((r) => r.path === path)
      return { path, displayName: repo?.name }
    })

    bulkCreateMutation.mutate(repos, {
      onSuccess: () => {
        onOpenChange(false)
        onSuccess?.()
      },
      onError: (err) => {
        setError(err instanceof Error ? err.message : t('bulkAdd.addFailed'))
      },
    })
  }

  const handleOpenChange = (nextOpen: boolean) => {
    if (!nextOpen) {
      setDirectory('')
      setScannedRepos(null)
      setSelected(new Set())
      setError(null)
    }
    onOpenChange(nextOpen)
  }

  return (
    <>
      <Dialog open={open} onOpenChange={handleOpenChange}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{t('bulkAdd.title')}</DialogTitle>
            <DialogDescription>{t('bulkAdd.description')}</DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            {/* Directory input */}
            <div className="space-y-2">
              <label className="text-xs font-medium text-muted-foreground">
                {t('bulkAdd.directoryLabel')}
              </label>
              <div className="flex gap-2">
                <Input
                  value={directory}
                  onChange={(e) => {
                    setDirectory(e.target.value)
                    setError(null)
                    setScannedRepos(null)
                  }}
                  placeholder={defaultGitReposDir || t('bulkAdd.directoryPlaceholder')}
                  disabled={isPending}
                  className="flex-1"
                />
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setBrowserOpen(true)}
                  disabled={isPending}
                >
                  {t('bulkAdd.browse')}
                </Button>
                <Button
                  type="button"
                  size="sm"
                  onClick={handleScan}
                  disabled={isPending || !effectiveDirectory}
                >
                  {scanMutation.isPending ? (
                    <HugeiconsIcon
                      icon={Loading03Icon}
                      size={16}
                      strokeWidth={2}
                      className="animate-spin"
                    />
                  ) : (
                    <HugeiconsIcon icon={Search01Icon} size={16} strokeWidth={2} />
                  )}
                  {t('bulkAdd.scan')}
                </Button>
              </div>
            </div>

            {/* Scan results */}
            {scannedRepos !== null && (
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-medium text-muted-foreground">
                    {t('bulkAdd.foundRepos', { count: scannedRepos.length })}
                  </label>
                  {addableRepos.length > 0 && (
                    <div className="flex gap-2 text-xs">
                      <button
                        type="button"
                        className="text-primary hover:underline"
                        onClick={handleSelectAll}
                        disabled={isPending}
                      >
                        {t('bulkAdd.selectAll')}
                      </button>
                      <span className="text-muted-foreground">/</span>
                      <button
                        type="button"
                        className="text-primary hover:underline"
                        onClick={handleSelectNone}
                        disabled={isPending}
                      >
                        {t('bulkAdd.selectNone')}
                      </button>
                    </div>
                  )}
                </div>

                {scannedRepos.length === 0 ? (
                  <div className="rounded-md bg-muted/50 px-3 py-4 text-center text-sm text-muted-foreground">
                    {t('bulkAdd.noReposFound')}
                  </div>
                ) : (
                  <div className="max-h-64 overflow-y-auto rounded-md border">
                    {scannedRepos.map((repo) => (
                      <div
                        key={repo.path}
                        className={`flex items-center gap-3 border-b px-3 py-2 last:border-b-0 ${
                          repo.exists ? 'bg-muted/30 opacity-60' : ''
                        }`}
                      >
                        <Checkbox
                          checked={selected.has(repo.path)}
                          onCheckedChange={() => handleToggle(repo.path)}
                          disabled={repo.exists || isPending}
                        />
                        <HugeiconsIcon
                          icon={repo.exists ? CheckmarkCircle02Icon : Folder01Icon}
                          size={16}
                          strokeWidth={2}
                          className={repo.exists ? 'text-green-500' : 'text-muted-foreground'}
                        />
                        <div className="min-w-0 flex-1">
                          <div className="truncate text-sm font-medium">{repo.name}</div>
                          <div className="truncate text-xs text-muted-foreground">
                            {repo.path}
                          </div>
                        </div>
                        {repo.exists && (
                          <span className="shrink-0 text-xs text-muted-foreground">
                            {t('bulkAdd.alreadyAdded')}
                          </span>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Adding state */}
            {bulkCreateMutation.isPending && (
              <div className="flex items-center justify-center gap-2 py-2 text-sm text-muted-foreground">
                <HugeiconsIcon
                  icon={Loading03Icon}
                  size={16}
                  strokeWidth={2}
                  className="animate-spin"
                />
                {t('bulkAdd.adding')}
              </div>
            )}

            {/* Error state */}
            {error && (
              <div className="flex items-start gap-2 rounded-md bg-destructive/10 px-3 py-2 text-xs text-destructive">
                <HugeiconsIcon
                  icon={Alert02Icon}
                  size={14}
                  strokeWidth={2}
                  className="mt-0.5 shrink-0"
                />
                <span>{error}</span>
              </div>
            )}
          </div>

          <DialogFooter>
            <DialogClose render={<Button variant="outline" disabled={isPending} />}>
              {t('bulkAdd.cancel')}
            </DialogClose>
            <Button
              onClick={handleAdd}
              disabled={selected.size === 0 || isPending}
            >
              {t('bulkAdd.addSelected', { count: selected.size })}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <FilesystemBrowser
        open={browserOpen}
        onOpenChange={setBrowserOpen}
        onSelect={handleBrowseSelect}
        initialPath={effectiveDirectory || undefined}
        mode="directory"
      />
    </>
  )
}
