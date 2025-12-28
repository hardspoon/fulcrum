import { useCallback } from 'react'
import { useNavigate } from '@tanstack/react-router'
import { toast } from 'sonner'
import { useStore } from '@/stores'
import { log } from '@/lib/logger'

/**
 * Hook for opening a repository in a dedicated terminal tab.
 *
 * Behavior:
 * 1. If tab exists for directory, navigates to it
 * 2. If not found, creates tab and navigates to /terminals
 *    (the terminals page creates the terminal via lastCreatedTabId)
 */
export function useOpenInTerminal() {
  const navigate = useNavigate()
  const store = useStore()

  const openInTerminal = useCallback(
    (directory: string, name: string) => {
      log.ws.info('useOpenInTerminal: openInTerminal called', {
        directory,
        name,
        connected: store.connected,
        tabCount: store.tabs.items.length,
      })

      if (!store.connected) {
        log.ws.warn('useOpenInTerminal: not connected, aborting')
        toast.error('Terminal not connected', {
          description: 'Please wait for the connection to establish',
        })
        return
      }

      // Check if tab with this directory already exists (access store directly for fresh data)
      const existingTab = store.tabs.items.find((t) => t.directory === directory)

      if (existingTab) {
        log.ws.info('useOpenInTerminal: navigating to existing tab', { tabId: existingTab.id })
        navigate({ to: '/terminals', search: { tab: existingTab.id } })
        return
      }

      // Create new tab with directory
      // The terminals page will create the terminal when lastCreatedTabId is set
      log.ws.info('useOpenInTerminal: creating new tab', { name, directory })
      store.createTab(name, undefined, directory)

      // Navigate to terminals page - the terminals page will:
      // 1. Wait for pendingTabCreation to clear (prevents redirect to other tabs)
      // 2. Use lastCreatedTabId to select the newly created tab
      // 3. Create a terminal in the new tab
      navigate({ to: '/terminals' })
    },
    [store, navigate]
  )

  return { openInTerminal, connected: store.connected }
}
