import { useEffect, useRef, useCallback, useState } from 'react'
import { fetchJSON } from '@/lib/api'
import type { FileStatResponse } from '@/types'

const API_BASE = ''

interface UseFileChangePollingOptions {
  worktreePath: string | null
  filePath: string | null
  currentMtime: string | null
  isDirty: boolean
  pollInterval?: number // Default: 3000ms
  enabled?: boolean
}

interface UseFileChangePollingResult {
  hasExternalChange: boolean
  isConflict: boolean // true if external change + dirty
  resetExternalChange: () => void
}

/**
 * Hook to poll for external file changes
 * Compares the file's mtime on disk with the last known mtime
 */
export function useFileChangePolling({
  worktreePath,
  filePath,
  currentMtime,
  isDirty,
  pollInterval = 3000,
  enabled = true,
}: UseFileChangePollingOptions): UseFileChangePollingResult {
  const [hasExternalChange, setHasExternalChange] = useState(false)
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const lastCheckedMtimeRef = useRef<string | null>(null)

  const checkForChanges = useCallback(async () => {
    if (!worktreePath || !filePath || !currentMtime) return

    try {
      const params = new URLSearchParams({
        path: filePath,
        root: worktreePath,
      })
      const stat = await fetchJSON<FileStatResponse>(
        `${API_BASE}/api/fs/file-stat?${params}`
      )

      if (stat.exists && stat.mtime !== currentMtime) {
        // Only set external change if this is a new mtime we haven't seen
        // This prevents repeated triggers if user chose "keep my changes"
        if (lastCheckedMtimeRef.current !== stat.mtime) {
          lastCheckedMtimeRef.current = stat.mtime
          setHasExternalChange(true)
        }
      }
    } catch {
      // Silently ignore polling errors (file may have been deleted)
    }
  }, [worktreePath, filePath, currentMtime])

  // Start/stop polling based on enabled state
  useEffect(() => {
    if (!enabled || !filePath || !currentMtime) {
      if (intervalRef.current) {
        clearInterval(intervalRef.current)
        intervalRef.current = null
      }
      return
    }

    // Reset tracking when file changes
    lastCheckedMtimeRef.current = null

    // Initial check after a short delay (let the UI settle)
    const initialTimeout = setTimeout(checkForChanges, 500)

    // Set up interval
    intervalRef.current = setInterval(checkForChanges, pollInterval)

    return () => {
      clearTimeout(initialTimeout)
      if (intervalRef.current) {
        clearInterval(intervalRef.current)
        intervalRef.current = null
      }
    }
  }, [enabled, filePath, currentMtime, pollInterval, checkForChanges])

  // Reset when file path changes
  useEffect(() => {
    setHasExternalChange(false)
    lastCheckedMtimeRef.current = null
  }, [filePath])

  const resetExternalChange = useCallback(() => {
    setHasExternalChange(false)
  }, [])

  return {
    hasExternalChange,
    isConflict: hasExternalChange && isDirty,
    resetExternalChange,
  }
}
