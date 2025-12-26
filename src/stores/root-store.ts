import { types, Instance, SnapshotIn, getEnv, destroy } from 'mobx-state-tree'
import { TerminalModel, TabModel, ViewStateModel } from './models'
import type { ITerminal, ITerminalSnapshot, ITab, ITabSnapshot } from './models'
import { log } from '@/lib/logger'

/**
 * Environment injected into the store.
 * Contains non-serializable dependencies like WebSocket.
 */
export interface StoreEnv {
  /** WebSocket send function */
  send: (message: object) => void
  /** Logger instance */
  log: typeof log
}

/**
 * Terminals collection with CRUD operations
 */
const TerminalsStore = types
  .model('TerminalsStore', {
    items: types.array(TerminalModel),
  })
  .views((self) => ({
    /** Get a terminal by ID */
    get(id: string): ITerminal | undefined {
      return self.items.find((t) => t.id === id)
    },

    /** Get all terminals for a specific tab */
    getByTab(tabId: string): ITerminal[] {
      return self.items
        .filter((t) => t.tabId === tabId)
        .sort((a, b) => a.positionInTab - b.positionInTab)
    },

    /** Get all task terminals (no tabId) */
    get taskTerminals(): ITerminal[] {
      return self.items.filter((t) => t.tabId == null)
    },

    /** Check if a terminal with given ID exists */
    has(id: string): boolean {
      return self.items.some((t) => t.id === id)
    },
  }))
  .actions((self) => ({
    /** Add a terminal from server data */
    add(data: ITerminalSnapshot) {
      // Prevent duplicates
      if (self.items.some((t) => t.id === data.id)) {
        log.ws.debug('Terminal already exists, skipping add', { id: data.id })
        return
      }
      self.items.push(data)
    },

    /** Remove a terminal by ID */
    remove(id: string) {
      const terminal = self.items.find((t) => t.id === id)
      if (terminal) {
        terminal.cleanup()
        destroy(terminal)
      }
    },

    /** Replace all terminals (for initial sync) */
    replaceAll(terminals: ITerminalSnapshot[]) {
      // Cleanup existing terminals
      for (const terminal of self.items) {
        terminal.cleanup()
      }
      self.items.clear()
      for (const t of terminals) {
        self.items.push(t)
      }
    },

    /** Clear all terminals */
    clear() {
      for (const terminal of self.items) {
        terminal.cleanup()
      }
      self.items.clear()
    },
  }))

/**
 * Tabs collection with CRUD operations
 */
const TabsStore = types
  .model('TabsStore', {
    items: types.array(TabModel),
  })
  .views((self) => ({
    /** Get a tab by ID */
    get(id: string): ITab | undefined {
      return self.items.find((t) => t.id === id)
    },

    /** Get all tabs sorted by position */
    get sorted(): ITab[] {
      return [...self.items].sort((a, b) => a.position - b.position)
    },

    /** Check if a tab with given ID exists */
    has(id: string): boolean {
      return self.items.some((t) => t.id === id)
    },

    /** Get the first tab (for default selection) */
    get first(): ITab | undefined {
      return this.sorted[0]
    },
  }))
  .actions((self) => ({
    /** Add a tab from server data */
    add(data: ITabSnapshot) {
      // Prevent duplicates
      if (self.items.some((t) => t.id === data.id)) {
        log.ws.debug('Tab already exists, skipping add', { id: data.id })
        return
      }
      self.items.push(data)
    },

    /** Remove a tab by ID */
    remove(id: string) {
      const tab = self.items.find((t) => t.id === id)
      if (tab) {
        destroy(tab)
      }
    },

    /** Replace all tabs (for initial sync) */
    replaceAll(tabs: ITabSnapshot[]) {
      self.items.clear()
      for (const t of tabs) {
        self.items.push(t)
      }
    },

    /** Clear all tabs */
    clear() {
      self.items.clear()
    },
  }))

/**
 * Root store composing all sub-stores.
 *
 * This is the main entry point for the MST store.
 * It manages terminals, tabs, and view state with WebSocket sync.
 */
export const RootStore = types
  .model('RootStore', {
    terminals: types.optional(TerminalsStore, { items: [] }),
    tabs: types.optional(TabsStore, { items: [] }),
    viewState: types.optional(ViewStateModel, {}),
  })
  .volatile(() => ({
    /** WebSocket connection state */
    connected: false,
    /** Whether initial sync has completed */
    initialized: false,
    /** Set of newly created terminal IDs (for auto-focus) */
    newTerminalIds: new Set<string>(),
    /** Pending optimistic updates awaiting server confirmation */
    pendingUpdates: new Map<string, { inverse: unknown }>(),
  }))
  .views((self) => ({
    /** Whether the store is ready for use */
    get isReady() {
      return self.connected && self.initialized
    },
  }))
  .actions((self) => {
    // Get environment (WebSocket send function)
    const getWs = () => getEnv<StoreEnv>(self)

    return {
      /** Mark as connected to WebSocket */
      setConnected(connected: boolean) {
        self.connected = connected
        if (!connected) {
          self.initialized = false
        }
      },

      /** Mark as initialized after initial sync */
      setInitialized(initialized: boolean) {
        self.initialized = initialized
      },

      /** Mark a terminal as newly created (for auto-focus) */
      markNewTerminal(id: string) {
        self.newTerminalIds.add(id)
      },

      /** Clear new terminal marker */
      clearNewTerminal(id: string) {
        self.newTerminalIds.delete(id)
      },

      // ============ Terminal Actions ============

      /** Request terminal creation from server */
      createTerminal(options: {
        name: string
        cols: number
        rows: number
        cwd?: string
        tabId?: string
        positionInTab?: number
      }) {
        getWs().send({
          type: 'terminal:create',
          payload: options,
        })
      },

      /** Request terminal destruction from server */
      destroyTerminal(terminalId: string, options?: { force?: boolean; reason?: string }) {
        getWs().send({
          type: 'terminal:destroy',
          payload: {
            terminalId,
            force: options?.force,
            reason: options?.reason,
          },
        })
        // Optimistic removal
        const terminal = self.terminals.get(terminalId)
        if (terminal) {
          terminal.cleanup()
        }
        self.terminals.remove(terminalId)
      },

      /** Send input to terminal */
      writeToTerminal(terminalId: string, data: string) {
        getWs().send({
          type: 'terminal:input',
          payload: { terminalId, data },
        })
      },

      /** Request terminal resize */
      resizeTerminal(terminalId: string, cols: number, rows: number) {
        getWs().send({
          type: 'terminal:resize',
          payload: { terminalId, cols, rows },
        })
        // Optimistic update
        const terminal = self.terminals.get(terminalId)
        terminal?.resize(cols, rows)
      },

      /** Request terminal rename */
      renameTerminal(terminalId: string, name: string) {
        getWs().send({
          type: 'terminal:rename',
          payload: { terminalId, name },
        })
        // Optimistic update
        const terminal = self.terminals.get(terminalId)
        terminal?.rename(name)
      },

      /** Request terminal attachment */
      attachTerminal(terminalId: string) {
        getWs().send({
          type: 'terminal:attach',
          payload: { terminalId },
        })
      },

      /** Request buffer clear */
      clearTerminalBuffer(terminalId: string) {
        getWs().send({
          type: 'terminal:clearBuffer',
          payload: { terminalId },
        })
      },

      /** Request tab assignment */
      assignTerminalToTab(terminalId: string, tabId: string | null, positionInTab?: number) {
        getWs().send({
          type: 'terminal:assignTab',
          payload: { terminalId, tabId, positionInTab },
        })
        // Optimistic update
        const terminal = self.terminals.get(terminalId)
        terminal?.assignToTab(tabId, positionInTab)
      },

      // ============ Tab Actions ============

      /** Request tab creation from server */
      createTab(name: string, position?: number, directory?: string) {
        getWs().send({
          type: 'tab:create',
          payload: { name, position, directory },
        })
      },

      /** Request tab update */
      updateTab(tabId: string, updates: { name?: string; directory?: string | null }) {
        getWs().send({
          type: 'tab:update',
          payload: { tabId, ...updates },
        })
        // Optimistic update
        const tab = self.tabs.get(tabId)
        tab?.updateFromServer(updates)
      },

      /** Request tab deletion */
      deleteTab(tabId: string) {
        getWs().send({
          type: 'tab:delete',
          payload: { tabId },
        })
        // Optimistic removal - terminals will be removed by server cascade
        self.tabs.remove(tabId)
        self.viewState.clearFocusedTerminalForTab(tabId)
      },

      /** Request tab reorder */
      reorderTab(tabId: string, position: number) {
        getWs().send({
          type: 'tab:reorder',
          payload: { tabId, position },
        })
        // Optimistic update
        const tab = self.tabs.get(tabId)
        tab?.setPosition(position)
      },

      // ============ Sync Actions ============

      /** Handle incoming WebSocket message */
      handleMessage(message: { type: string; payload: unknown }) {
        const { type, payload } = message

        switch (type) {
          case 'terminals:list':
            self.terminals.replaceAll((payload as { terminals: ITerminalSnapshot[] }).terminals)
            break

          case 'terminal:created': {
            const { terminal, isNew } = payload as { terminal: ITerminalSnapshot; isNew: boolean }
            self.terminals.add(terminal)
            if (isNew) {
              self.newTerminalIds.add(terminal.id)
            }
            break
          }

          case 'terminal:destroyed': {
            const { terminalId } = payload as { terminalId: string }
            self.terminals.remove(terminalId)
            self.newTerminalIds.delete(terminalId)
            break
          }

          case 'terminal:exit': {
            const { terminalId, exitCode } = payload as { terminalId: string; exitCode: number }
            self.terminals.get(terminalId)?.markExited(exitCode)
            break
          }

          case 'terminal:renamed': {
            const { terminalId, name } = payload as { terminalId: string; name: string }
            self.terminals.get(terminalId)?.rename(name)
            break
          }

          case 'terminal:tabAssigned': {
            const { terminalId, tabId, positionInTab } = payload as {
              terminalId: string
              tabId: string | null
              positionInTab: number
            }
            self.terminals.get(terminalId)?.assignToTab(tabId, positionInTab)
            break
          }

          case 'tabs:list':
            self.tabs.replaceAll((payload as { tabs: ITabSnapshot[] }).tabs)
            self.initialized = true
            break

          case 'tab:created': {
            const { tab } = payload as { tab: ITabSnapshot }
            self.tabs.add(tab)
            break
          }

          case 'tab:updated': {
            const { tabId, name, directory } = payload as {
              tabId: string
              name?: string
              directory?: string | null
            }
            self.tabs.get(tabId)?.updateFromServer({ name, directory })
            break
          }

          case 'tab:deleted': {
            const { tabId } = payload as { tabId: string }
            self.tabs.remove(tabId)
            self.viewState.clearFocusedTerminalForTab(tabId)
            break
          }

          case 'tab:reordered': {
            const { tabId, position } = payload as { tabId: string; position: number }
            self.tabs.get(tabId)?.setPosition(position)
            break
          }

          case 'terminal:error': {
            const { error } = payload as { terminalId?: string; error: string }
            log.ws.error('Terminal error from server', { error })
            break
          }

          default:
            // Unknown message type - ignore
            break
        }
      },

      /** Reset store state (for reconnection) */
      reset() {
        self.terminals.clear()
        self.tabs.clear()
        self.connected = false
        self.initialized = false
        self.newTerminalIds.clear()
        self.pendingUpdates.clear()
      },
    }
  })

export type IRootStore = Instance<typeof RootStore>
export type IRootStoreSnapshot = SnapshotIn<typeof RootStore>
