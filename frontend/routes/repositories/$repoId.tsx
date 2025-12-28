import { useState, useEffect, useCallback, useRef } from 'react'
import { createFileRoute, Link, useNavigate } from '@tanstack/react-router'
import { useRepository, useUpdateRepository, useDeleteRepository } from '@/hooks/use-repositories'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Field, FieldGroup, FieldLabel, FieldDescription } from '@/components/ui/field'
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
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { ScrollArea } from '@/components/ui/scroll-area'
import { ResizablePanelGroup, ResizablePanel, ResizableHandle } from '@/components/ui/resizable'
import { HugeiconsIcon } from '@hugeicons/react'
import {
  ArrowLeft02Icon,
  Delete02Icon,
  Folder01Icon,
  Loading03Icon,
  Alert02Icon,
  TaskAdd01Icon,
  Tick02Icon,
  GridViewIcon,
} from '@hugeicons/core-free-icons'
import { toast } from 'sonner'
import { Checkbox } from '@/components/ui/checkbox'
import { CreateTaskModal } from '@/components/kanban/create-task-modal'
import { FilesViewer } from '@/components/viewer/files-viewer'
import { GitStatusBadge } from '@/components/viewer/git-status-badge'
import { Terminal } from '@/components/terminal/terminal'
import { useTerminalWS } from '@/hooks/use-terminal-ws'
import { log } from '@/lib/logger'
import type { Terminal as XTerm } from '@xterm/xterm'

type RepoTab = 'settings' | 'workspace'

interface RepoDetailSearch {
  tab?: RepoTab
  file?: string
}

/**
 * Repository detail view with integrated workspace (terminal + files).
 */
function RepositoryDetailView() {
  const { repoId } = Route.useParams()
  const { tab, file } = Route.useSearch()
  const navigate = useNavigate()
  const { data: repository, isLoading, error } = useRepository(repoId)
  const updateRepository = useUpdateRepository()
  const deleteRepository = useDeleteRepository()

  // Form state
  const [displayName, setDisplayName] = useState('')
  const [startupScript, setStartupScript] = useState('')
  const [copyFiles, setCopyFiles] = useState('')
  const [isCopierTemplate, setIsCopierTemplate] = useState(false)
  const [hasChanges, setHasChanges] = useState(false)
  const [taskModalOpen, setTaskModalOpen] = useState(false)

  // Terminal state
  const [terminalId, setTerminalId] = useState<string | null>(null)
  const [isCreatingTerminal, setIsCreatingTerminal] = useState(false)
  const [xtermReady, setXtermReady] = useState(false)
  const [containerReady, setContainerReady] = useState(false)
  const termRef = useRef<XTerm | null>(null)
  const containerRef = useRef<HTMLDivElement | null>(null)
  const createdTerminalRef = useRef(false)
  const attachedRef = useRef(false)

  const {
    terminals,
    terminalsLoaded,
    connected,
    createTerminal,
    attachXterm,
    resizeTerminal,
    setupImagePaste,
    writeToTerminal,
  } = useTerminalWS()

  const activeTab = tab || 'settings'

  // Log on mount
  useEffect(() => {
    log.repoTerminal.info('component mounted', { repoId, tab, activeTab })
  }, [repoId, tab, activeTab])

  useEffect(() => {
    log.repoTerminal.debug('state changed', {
      terminalId,
      xtermReady,
      containerReady,
      connected,
      terminalsLoaded,
      terminalCount: terminals.length,
      repoPath: repository?.path,
    })
  }, [terminalId, xtermReady, containerReady, connected, terminalsLoaded, terminals.length, repository?.path])

  const setActiveTab = useCallback(
    (newTab: RepoTab) => {
      navigate({
        to: '/repositories/$repoId',
        params: { repoId },
        search: newTab === 'settings' ? {} : { tab: newTab, file },
        replace: true,
      })
    },
    [navigate, repoId, file]
  )

  const handleFileChange = useCallback(
    (newFile: string | null) => {
      navigate({
        to: '/repositories/$repoId',
        params: { repoId },
        search: { tab: 'workspace', file: newFile ?? undefined },
        replace: true,
      })
    },
    [navigate, repoId]
  )

  // Initialize form state when repository loads
  useEffect(() => {
    if (repository) {
      setDisplayName(repository.displayName)
      setStartupScript(repository.startupScript || '')
      setCopyFiles(repository.copyFiles || '')
      setIsCopierTemplate(repository.isCopierTemplate ?? false)
      setHasChanges(false)
    }
  }, [repository])

  // Track changes
  useEffect(() => {
    if (repository) {
      const changed =
        displayName !== repository.displayName ||
        startupScript !== (repository.startupScript || '') ||
        copyFiles !== (repository.copyFiles || '') ||
        isCopierTemplate !== (repository.isCopierTemplate ?? false)
      setHasChanges(changed)
    }
  }, [displayName, startupScript, copyFiles, isCopierTemplate, repository])

  const handleSave = () => {
    if (!repository) return

    updateRepository.mutate(
      {
        id: repository.id,
        updates: {
          displayName: displayName.trim() || repository.path.split('/').pop() || 'repo',
          startupScript: startupScript.trim() || null,
          copyFiles: copyFiles.trim() || null,
          isCopierTemplate,
        },
      },
      {
        onSuccess: () => {
          toast.success('Repository saved')
          setHasChanges(false)
        },
        onError: (error) => {
          toast.error('Failed to save repository', {
            description: error instanceof Error ? error.message : 'Unknown error',
          })
        },
      }
    )
  }

  const handleDelete = async () => {
    if (!repository) return
    await deleteRepository.mutateAsync(repository.id)
    navigate({ to: '/repositories' })
  }

  // Reset terminal state when repository changes
  // Note: Don't reset xtermReady - the Terminal component stays mounted and reuses the same xterm instance
  useEffect(() => {
    createdTerminalRef.current = false
    attachedRef.current = false
    setTerminalId(null)
    setIsCreatingTerminal(false)
  }, [repository?.path])

  // Find or create terminal when workspace tab is active
  useEffect(() => {
    if (!connected || !repository?.path || !terminalsLoaded || activeTab !== 'workspace' || !xtermReady) {
      log.repoTerminal.debug('find/create: waiting', { connected, path: repository?.path, terminalsLoaded, activeTab, xtermReady })
      return
    }

    // Look for existing terminal with matching cwd
    const existingTerminal = terminals.find((t) => t.cwd === repository.path)
    if (existingTerminal) {
      log.repoTerminal.info('found existing terminal', { id: existingTerminal.id, cwd: existingTerminal.cwd })
      setTerminalId(existingTerminal.id)
      return
    }

    // Create terminal only once
    if (!createdTerminalRef.current && termRef.current) {
      createdTerminalRef.current = true
      setIsCreatingTerminal(true)
      const { cols, rows } = termRef.current
      log.repoTerminal.info('creating terminal', { name: repository.displayName, cwd: repository.path, cols, rows })
      createTerminal({
        name: repository.displayName,
        cols,
        rows,
        cwd: repository.path,
      })
    }
  }, [connected, repository?.path, repository?.displayName, terminalsLoaded, terminals, activeTab, createTerminal, xtermReady])

  // Update terminalId when terminal appears in list
  useEffect(() => {
    if (!repository?.path) return

    const matchingTerminal = terminals.find((t) => t.cwd === repository.path)
    if (!matchingTerminal) return

    const currentTerminalExists = terminalId && terminals.some((t) => t.id === terminalId)

    if (!terminalId || !currentTerminalExists) {
      setTerminalId(matchingTerminal.id)
      setIsCreatingTerminal(false)
      if (terminalId && !currentTerminalExists) {
        attachedRef.current = false
      }
    }
  }, [terminals, repository?.path, terminalId])

  // Terminal callbacks
  const handleTerminalReady = useCallback((xterm: XTerm) => {
    log.repoTerminal.info('xterm ready')
    termRef.current = xterm
    setXtermReady(true)
  }, [])

  const handleTerminalResize = useCallback((cols: number, rows: number) => {
    if (terminalId) {
      resizeTerminal(terminalId, cols, rows)
    }
  }, [terminalId, resizeTerminal])

  const handleTerminalContainerReady = useCallback((container: HTMLDivElement) => {
    log.repoTerminal.info('container ready')
    containerRef.current = container
    setContainerReady(true)
  }, [])

  const handleTerminalSend = useCallback((data: string) => {
    if (terminalId) {
      writeToTerminal(terminalId, data)
    }
  }, [terminalId, writeToTerminal])

  // Attach xterm to terminal once we have terminalId and both xterm/container are ready
  useEffect(() => {
    if (!terminalId || !xtermReady || !containerReady) {
      log.repoTerminal.debug('attach effect: waiting', { terminalId, xtermReady, containerReady })
      return
    }
    if (!termRef.current || !containerRef.current) {
      log.repoTerminal.warn('attach effect: refs not set despite ready states', { terminalId })
      return
    }
    if (attachedRef.current) {
      log.repoTerminal.debug('attach effect: already attached', { terminalId })
      return
    }

    log.repoTerminal.info('attaching terminal', { terminalId })
    attachXterm(terminalId, termRef.current)
    setupImagePaste(containerRef.current, terminalId)
    attachedRef.current = true

    return () => {
      log.repoTerminal.debug('detaching terminal', { terminalId })
      attachedRef.current = false
    }
  }, [terminalId, xtermReady, containerReady, attachXterm, setupImagePaste])

  if (isLoading) {
    return (
      <div className="flex h-full items-center justify-center">
        <HugeiconsIcon
          icon={Loading03Icon}
          size={24}
          strokeWidth={2}
          className="animate-spin text-muted-foreground"
        />
      </div>
    )
  }

  if (error || !repository) {
    return (
      <div className="flex h-full flex-col">
        <div className="flex shrink-0 items-center gap-2 border-b border-border bg-background px-4 py-2">
          <Link to="/repositories" className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
            <HugeiconsIcon icon={ArrowLeft02Icon} size={16} strokeWidth={2} />
            Repositories
          </Link>
        </div>
        <div className="flex flex-1 items-center justify-center">
          <div className="flex items-center gap-3 text-destructive">
            <HugeiconsIcon icon={Alert02Icon} size={20} strokeWidth={2} />
            <span className="text-sm">Repository not found</span>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="flex h-full flex-col">
      <div className="flex shrink-0 items-center justify-between border-b border-border bg-background px-4 py-2">
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setTaskModalOpen(true)}
            className="text-muted-foreground hover:text-foreground"
          >
            <HugeiconsIcon icon={TaskAdd01Icon} size={16} strokeWidth={2} data-slot="icon" className="-translate-y-px" />
            <span className="max-sm:hidden">New Task</span>
          </Button>

          <Button
            variant="ghost"
            size="sm"
            onClick={() => navigate({ to: '/tasks', search: { repo: repository.displayName } })}
            className="text-muted-foreground hover:text-foreground"
            title="View Tasks"
          >
            <HugeiconsIcon icon={GridViewIcon} size={14} strokeWidth={2} data-slot="icon" />
            <span className="max-sm:hidden">Tasks</span>
          </Button>
        </div>

        <div className="flex items-center gap-3">
          <GitStatusBadge worktreePath={repository.path} />
          <span className="text-sm font-medium">{repository.displayName}</span>
        </div>
      </div>

      <Tabs
        value={activeTab}
        onValueChange={(v) => setActiveTab(v as RepoTab)}
        className="flex flex-1 flex-col overflow-hidden"
      >
        <div className="shrink-0 border-b border-border bg-muted/50 px-4">
          <TabsList variant="line">
            <TabsTrigger value="settings" className="px-3 py-1.5">Settings</TabsTrigger>
            <TabsTrigger value="workspace" className="px-3 py-1.5">Workspace</TabsTrigger>
          </TabsList>
        </div>

        <TabsContent value="settings" className="flex-1 overflow-hidden mt-0">
          <ScrollArea className="h-full">
            <div className="p-4">
              <div className="mx-auto max-w-xl space-y-6 bg-card rounded-lg p-6 border border-border">
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <HugeiconsIcon icon={Folder01Icon} size={14} strokeWidth={2} />
                  <span className="font-mono break-all">{repository.path}</span>
                </div>

                <FieldGroup>
                  <Field>
                    <FieldLabel htmlFor="displayName">Display Name</FieldLabel>
                    <Input
                      id="displayName"
                      value={displayName}
                      onChange={(e) => setDisplayName(e.target.value)}
                      placeholder={repository.path.split('/').pop() || 'My Project'}
                    />
                  </Field>

                  <Field>
                    <FieldLabel htmlFor="startupScript">Startup Script</FieldLabel>
                    <Textarea
                      id="startupScript"
                      value={startupScript}
                      onChange={(e) => setStartupScript(e.target.value)}
                      placeholder="npm install && npm run dev"
                      rows={3}
                    />
                    <FieldDescription>
                      Command to run in the terminal when creating a worktree.
                    </FieldDescription>
                  </Field>

                  <Field>
                    <FieldLabel htmlFor="copyFiles">Copy Files</FieldLabel>
                    <Input
                      id="copyFiles"
                      value={copyFiles}
                      onChange={(e) => setCopyFiles(e.target.value)}
                      placeholder=".env, config.local.json"
                    />
                    <FieldDescription>
                      Comma-separated glob patterns for files to copy into new worktrees.
                    </FieldDescription>
                  </Field>

                  <Field>
                    <div className="flex items-center gap-2">
                      <Checkbox
                        checked={isCopierTemplate}
                        onCheckedChange={(checked) => setIsCopierTemplate(checked === true)}
                      />
                      <FieldLabel className="cursor-pointer">Use as Copier Template</FieldLabel>
                    </div>
                    <FieldDescription>
                      Mark as a template for creating new projects with Copier.
                    </FieldDescription>
                  </Field>
                </FieldGroup>

                <div className="flex items-center justify-end gap-2 pt-4 border-t border-border">
                  <AlertDialog>
                    <AlertDialogTrigger
                      render={
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-muted-foreground hover:text-destructive"
                        />
                      }
                    >
                      <HugeiconsIcon icon={Delete02Icon} size={14} strokeWidth={2} data-slot="icon" />
                      Delete
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Delete Repository</AlertDialogTitle>
                        <AlertDialogDescription>
                          This will remove "{repository.displayName}" from Vibora. The actual repository
                          files will not be affected.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <Button variant="destructive" onClick={handleDelete}>
                          Delete
                        </Button>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>

                  <Button
                    size="sm"
                    onClick={handleSave}
                    disabled={!hasChanges || updateRepository.isPending}
                  >
                    <HugeiconsIcon icon={Tick02Icon} size={14} strokeWidth={2} data-slot="icon" />
                    {updateRepository.isPending ? 'Saving...' : 'Save'}
                  </Button>
                </div>
              </div>
            </div>
          </ScrollArea>
        </TabsContent>

        <TabsContent value="workspace" className="flex-1 overflow-hidden mt-0">
          <ResizablePanelGroup direction="horizontal" className="h-full">
            <ResizablePanel defaultSize={50} minSize={30}>
              <div className="h-full flex flex-col">
                {!connected && (
                  <div className="shrink-0 px-2 py-1 bg-muted-foreground/20 text-muted-foreground text-xs">
                    Connecting to terminal server...
                  </div>
                )}
                {isCreatingTerminal && !terminalId && (
                  <div className="flex-1 flex items-center justify-center bg-terminal-background">
                    <div className="flex flex-col items-center gap-3">
                      <HugeiconsIcon
                        icon={Loading03Icon}
                        size={24}
                        strokeWidth={2}
                        className="animate-spin text-muted-foreground"
                      />
                      <span className="font-mono text-sm text-muted-foreground">
                        Initializing terminal...
                      </span>
                    </div>
                  </div>
                )}
                <Terminal
                  className="flex-1"
                  onReady={handleTerminalReady}
                  onResize={handleTerminalResize}
                  onContainerReady={handleTerminalContainerReady}
                  terminalId={terminalId ?? undefined}
                  setupImagePaste={setupImagePaste}
                  onSend={handleTerminalSend}
                />
              </div>
            </ResizablePanel>
            <ResizableHandle withHandle />
            <ResizablePanel defaultSize={50} minSize={30}>
              <FilesViewer
                worktreePath={repository.path}
                initialSelectedFile={file}
                onFileChange={handleFileChange}
              />
            </ResizablePanel>
          </ResizablePanelGroup>
        </TabsContent>
      </Tabs>

      <CreateTaskModal
        open={taskModalOpen}
        onOpenChange={setTaskModalOpen}
        defaultRepository={repository}
        showTrigger={false}
      />
    </div>
  )
}

export const Route = createFileRoute('/repositories/$repoId')({
  component: RepositoryDetailView,
  validateSearch: (search: Record<string, unknown>): RepoDetailSearch => ({
    tab: search.tab === 'workspace' ? 'workspace' : undefined,
    file: typeof search.file === 'string' ? search.file : undefined,
  }),
})
