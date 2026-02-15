import { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { fetchJSON } from '@/lib/api'
import type { ScratchDir, ScratchDirBasic, ScratchDirDetails, ScratchDirsSummary } from '@/types'
import { log } from '@/lib/logger'

const API_BASE = ''

interface UseScratchDirsReturn {
  dirs: ScratchDir[]
  summary: ScratchDirsSummary | null
  isLoading: boolean
  isLoadingDetails: boolean
  error: Error | null
  refetch: () => void
}

interface ScratchDirsJsonResponse {
  dirs: (ScratchDirBasic & Partial<ScratchDirDetails>)[]
  summary: ScratchDirsSummary
}

export function useScratchDirs(): UseScratchDirsReturn {
  const [dirsMap, setDirsMap] = useState<Map<string, ScratchDir>>(new Map())
  const [summary, setSummary] = useState<ScratchDirsSummary | null>(null)
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
      const response = await fetch(`${API_BASE}/api/scratch-dirs/json`)
      if (!response.ok) throw new Error('Failed to fetch scratch dirs')
      const data: ScratchDirsJsonResponse = await response.json()

      setDirsMap(
        new Map(
          data.dirs.map((d) => [
            d.path,
            {
              ...d,
              size: d.size || 0,
              sizeFormatted: d.sizeFormatted || '0 B',
            },
          ])
        )
      )
      setSummary(data.summary)
      setIsLoading(false)
      setIsLoadingDetails(false)
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Failed to load scratch dirs'))
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
    setDirsMap(new Map())
    setSummary(null)

    const eventSource = new EventSource(`${API_BASE}/api/scratch-dirs`)
    eventSourceRef.current = eventSource

    eventSource.addEventListener('scratch:basic', (e) => {
      const basics: ScratchDirBasic[] = JSON.parse(e.data)
      pendingDetailsRef.current = basics.length

      setDirsMap(
        new Map(
          basics.map((b) => [
            b.path,
            {
              ...b,
              size: 0,
              sizeFormatted: '...',
            },
          ])
        )
      )
      setIsLoading(false)
      setIsLoadingDetails(basics.length > 0)
    })

    eventSource.addEventListener('scratch:details', (e) => {
      const details: ScratchDirDetails = JSON.parse(e.data)

      setDirsMap((prev) => {
        const next = new Map(prev)
        const existing = next.get(details.path)
        if (existing) {
          next.set(details.path, {
            ...existing,
            size: details.size,
            sizeFormatted: details.sizeFormatted,
          })
        }
        return next
      })

      pendingDetailsRef.current--
      if (pendingDetailsRef.current <= 0) {
        setIsLoadingDetails(false)
      }
    })

    eventSource.addEventListener('scratch:complete', (e) => {
      const summaryData: ScratchDirsSummary = JSON.parse(e.data)
      setSummary(summaryData)
      setIsLoadingDetails(false)
      eventSource.close()
    })

    eventSource.addEventListener('scratch:error', (e) => {
      const { path: errorPath } = JSON.parse(e.data)
      log.viewer.error('Error loading scratch dir details', { path: errorPath })
      pendingDetailsRef.current--
      if (pendingDetailsRef.current <= 0) {
        setIsLoadingDetails(false)
      }
    })

    eventSource.onerror = () => {
      eventSource.close()
      // SSE failed, try JSON fallback
      log.viewer.info('SSE connection failed for scratch dirs, trying JSON fallback')
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
  const sortedDirs = useMemo(() => {
    const arr = Array.from(dirsMap.values())
    // Sort: orphaned first, then by lastModified (newest first)
    return arr.sort((a, b) => {
      if (a.isOrphaned !== b.isOrphaned) return a.isOrphaned ? -1 : 1
      return new Date(b.lastModified).getTime() - new Date(a.lastModified).getTime()
    })
  }, [dirsMap])

  return {
    dirs: sortedDirs,
    summary,
    isLoading,
    isLoadingDetails,
    error,
    refetch: connect,
  }
}

export function useDeleteScratchDir() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({
      dirPath,
      deleteLinkedTask,
    }: {
      dirPath: string
      deleteLinkedTask?: boolean
    }) =>
      fetchJSON<{ success: boolean; path: string }>(`${API_BASE}/api/scratch-dirs`, {
        method: 'DELETE',
        body: JSON.stringify({ dirPath, deleteLinkedTask }),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['scratch-dirs'] })
      queryClient.invalidateQueries({ queryKey: ['tasks'] })
    },
  })
}

export function usePinScratchDir() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ taskId, pinned }: { taskId: string; pinned: boolean }) =>
      fetchJSON<{ id: string; pinned: boolean }>(`${API_BASE}/api/tasks/${taskId}`, {
        method: 'PATCH',
        body: JSON.stringify({ pinned }),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['scratch-dirs'] })
      queryClient.invalidateQueries({ queryKey: ['tasks'] })
    },
  })
}
