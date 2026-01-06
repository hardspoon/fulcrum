import { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { fetchJSON } from '@/lib/api'
import type { Worktree, WorktreeBasic, WorktreeDetails, WorktreesSummary } from '@/types'
import { log } from '@/lib/logger'

const API_BASE = ''

interface UseWorktreesReturn {
  worktrees: Worktree[]
  summary: WorktreesSummary | null
  isLoading: boolean
  isLoadingDetails: boolean
  error: Error | null
  refetch: () => void
}

interface WorktreesJsonResponse {
  worktrees: (WorktreeBasic & Partial<WorktreeDetails>)[]
  summary: WorktreesSummary
}

export function useWorktrees(): UseWorktreesReturn {
  const [worktreesMap, setWorktreesMap] = useState<Map<string, Worktree>>(new Map())
  const [summary, setSummary] = useState<WorktreesSummary | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isLoadingDetails, setIsLoadingDetails] = useState(false)
  const [error, setError] = useState<Error | null>(null)
  const eventSourceRef = useRef<EventSource | null>(null)
  const pendingDetailsRef = useRef<number>(0)
  const useJsonFallbackRef = useRef(false)

  // JSON fallback for environments where SSE doesn't work (e.g., Cloudflare tunnels)
  const fetchJson = useCallback(async () => {
    setIsLoading(true)
    setError(null)
    try {
      const response = await fetch(`${API_BASE}/api/worktrees/json`)
      if (!response.ok) throw new Error('Failed to fetch worktrees')
      const data: WorktreesJsonResponse = await response.json()

      setWorktreesMap(
        new Map(
          data.worktrees.map((w) => [
            w.path,
            {
              ...w,
              size: w.size || 0,
              sizeFormatted: w.sizeFormatted || '0 B',
              branch: w.branch || 'unknown',
            },
          ])
        )
      )
      setSummary(data.summary)
      setIsLoading(false)
      setIsLoadingDetails(false)
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Failed to load worktrees'))
      setIsLoading(false)
      setIsLoadingDetails(false)
    }
  }, [])

  const connect = useCallback(() => {
    // If we've determined SSE doesn't work, use JSON fallback
    if (useJsonFallbackRef.current) {
      fetchJson()
      return
    }

    // Close existing connection
    eventSourceRef.current?.close()

    setIsLoading(true)
    setIsLoadingDetails(false)
    setError(null)
    setWorktreesMap(new Map())
    setSummary(null)

    const eventSource = new EventSource(`${API_BASE}/api/worktrees`)
    eventSourceRef.current = eventSource

    eventSource.addEventListener('worktree:basic', (e) => {
      const basics: WorktreeBasic[] = JSON.parse(e.data)
      pendingDetailsRef.current = basics.length

      setWorktreesMap(
        new Map(
          basics.map((b) => [
            b.path,
            {
              ...b,
              size: 0,
              sizeFormatted: '...',
              branch: '...',
            },
          ])
        )
      )
      setIsLoading(false)
      setIsLoadingDetails(basics.length > 0)
    })

    eventSource.addEventListener('worktree:details', (e) => {
      const details: WorktreeDetails = JSON.parse(e.data)

      setWorktreesMap((prev) => {
        const next = new Map(prev)
        const existing = next.get(details.path)
        if (existing) {
          next.set(details.path, {
            ...existing,
            size: details.size,
            sizeFormatted: details.sizeFormatted,
            branch: details.branch,
          })
        }
        return next
      })

      pendingDetailsRef.current--
      if (pendingDetailsRef.current <= 0) {
        setIsLoadingDetails(false)
      }
    })

    eventSource.addEventListener('worktree:complete', (e) => {
      const summaryData: WorktreesSummary = JSON.parse(e.data)
      setSummary(summaryData)
      setIsLoadingDetails(false)
      eventSource.close()
    })

    eventSource.addEventListener('worktree:error', (e) => {
      const { path: errorPath } = JSON.parse(e.data)
      log.viewer.error('Error loading worktree details', { path: errorPath })
      pendingDetailsRef.current--
      if (pendingDetailsRef.current <= 0) {
        setIsLoadingDetails(false)
      }
    })

    eventSource.onerror = () => {
      eventSource.close()
      // SSE failed, try JSON fallback
      log.viewer.info('SSE connection failed, trying JSON fallback')
      useJsonFallbackRef.current = true
      fetchJson()
    }
  }, [fetchJson])

  useEffect(() => {
    connect()
    return () => {
      eventSourceRef.current?.close()
    }
  }, [connect])

  // Convert Map to sorted array (maintain sort order from server)
  const sortedWorktrees = useMemo(() => {
    const arr = Array.from(worktreesMap.values())
    // Sort: orphaned first, then by lastModified (newest first)
    return arr.sort((a, b) => {
      if (a.isOrphaned !== b.isOrphaned) return a.isOrphaned ? -1 : 1
      return new Date(b.lastModified).getTime() - new Date(a.lastModified).getTime()
    })
  }, [worktreesMap])

  return {
    worktrees: sortedWorktrees,
    summary,
    isLoading,
    isLoadingDetails,
    error,
    refetch: connect,
  }
}

export function useDeleteWorktree() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({
      worktreePath,
      repoPath,
      deleteLinkedTask,
    }: {
      worktreePath: string
      repoPath?: string
      deleteLinkedTask?: boolean
    }) =>
      fetchJSON<{ success: boolean; path: string }>(`${API_BASE}/api/worktrees`, {
        method: 'DELETE',
        body: JSON.stringify({ worktreePath, repoPath, deleteLinkedTask }),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['worktrees'] })
      queryClient.invalidateQueries({ queryKey: ['tasks'] })
    },
  })
}

export function usePinWorktree() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ taskId, pinned }: { taskId: string; pinned: boolean }) =>
      fetchJSON<{ id: string; pinned: boolean }>(`${API_BASE}/api/tasks/${taskId}`, {
        method: 'PATCH',
        body: JSON.stringify({ pinned }),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['worktrees'] })
      queryClient.invalidateQueries({ queryKey: ['tasks'] })
    },
  })
}
