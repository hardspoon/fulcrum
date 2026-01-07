import { useEffect, useRef, useCallback } from 'react'
import { fetchJSON } from '@/lib/api'
import type { FileTreeEntry } from '@/types'

const API_BASE = ''

interface FileTreeResponse {
  root: string
  entries: FileTreeEntry[]
}

interface UseFileTreePollingOptions {
  worktreePath: string | null
  currentTree: FileTreeEntry[] | null
  onTreeChanged: (entries: FileTreeEntry[]) => void
  pollInterval?: number // Default: 5000ms
  enabled?: boolean
}

/**
 * Serialize tree to a simple string for comparison
 * Only includes file/dir names and paths, ignoring order
 */
function serializeTree(entries: FileTreeEntry[]): string {
  const paths: string[] = []
  function traverse(nodes: FileTreeEntry[]) {
    for (const node of nodes) {
      paths.push(`${node.type}:${node.path}`)
      if (node.children) {
        traverse(node.children)
      }
    }
  }
  traverse(entries)
  return paths.sort().join('|')
}

/**
 * Hook to poll for file tree changes
 * Compares the tree structure to detect added/removed files
 */
export function useFileTreePolling({
  worktreePath,
  currentTree,
  onTreeChanged,
  pollInterval = 5000,
  enabled = true,
}: UseFileTreePollingOptions): void {
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const lastTreeHashRef = useRef<string | null>(null)
  const onTreeChangedRef = useRef(onTreeChanged)

  // Keep callback ref up to date
  useEffect(() => {
    onTreeChangedRef.current = onTreeChanged
  }, [onTreeChanged])

  // Update hash when current tree changes
  useEffect(() => {
    if (currentTree) {
      lastTreeHashRef.current = serializeTree(currentTree)
    }
  }, [currentTree])

  const checkForChanges = useCallback(async () => {
    if (!worktreePath) return

    try {
      const response = await fetchJSON<FileTreeResponse>(
        `${API_BASE}/api/fs/tree?root=${encodeURIComponent(worktreePath)}`
      )

      const newHash = serializeTree(response.entries)

      // Only trigger update if tree structure changed
      if (lastTreeHashRef.current !== null && newHash !== lastTreeHashRef.current) {
        lastTreeHashRef.current = newHash
        onTreeChangedRef.current(response.entries)
      }
    } catch {
      // Silently ignore polling errors
    }
  }, [worktreePath])

  // Start/stop polling based on enabled state
  useEffect(() => {
    if (!enabled || !worktreePath || !currentTree) {
      if (intervalRef.current) {
        clearInterval(intervalRef.current)
        intervalRef.current = null
      }
      return
    }

    // Set up interval
    intervalRef.current = setInterval(checkForChanges, pollInterval)

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current)
        intervalRef.current = null
      }
    }
  }, [enabled, worktreePath, currentTree, pollInterval, checkForChanges])

  // Reset when worktree changes
  useEffect(() => {
    lastTreeHashRef.current = null
  }, [worktreePath])
}
