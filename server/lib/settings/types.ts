import * as os from 'os'
import type { AgentType } from '@shared/types'

// Schema version for settings migration
// IMPORTANT: This must match the major version in package.json
// When bumping schema version, also bump major version with: mise run bump major
export const CURRENT_SCHEMA_VERSION = 2

// Editor app types
export type EditorApp = 'vscode' | 'cursor' | 'windsurf' | 'zed' | 'antigravity'

// Claude Code theme types
export type ClaudeCodeTheme = 'light' | 'light-ansi' | 'light-daltonized' | 'dark' | 'dark-ansi' | 'dark-daltonized'
export const CLAUDE_CODE_THEMES: ClaudeCodeTheme[] = ['light', 'light-ansi', 'light-daltonized', 'dark', 'dark-ansi', 'dark-daltonized']

// Task type for defaults
export type TaskType = 'worktree' | 'non-worktree'

// Assistant provider and model types
export type AssistantProvider = 'claude' | 'opencode'
export type AssistantModel = 'opus' | 'sonnet' | 'haiku'

// Nested settings interface
export interface Settings {
  _schemaVersion?: number
  server: {
    port: number
  }
  paths: {
    defaultGitReposDir: string
  }
  editor: {
    app: EditorApp
    host: string
    sshPort: number
  }
  integrations: {
    githubPat: string | null
    cloudflareApiToken: string | null
    cloudflareAccountId: string | null
  }
  agent: {
    defaultAgent: AgentType
    opencodeModel: string | null
    opencodeDefaultAgent: string
    opencodePlanAgent: string
    autoScrollToBottom: boolean
  }
  tasks: {
    defaultTaskType: TaskType
    startWorktreeTasksImmediately: boolean
  }
  appearance: {
    language: 'en' | 'zh' | null
    theme: 'system' | 'light' | 'dark' | null
    timezone: string | null // IANA timezone, null = system default
    syncClaudeCodeTheme: boolean
    claudeCodeLightTheme: ClaudeCodeTheme
    claudeCodeDarkTheme: ClaudeCodeTheme
  }
  assistant: {
    provider: AssistantProvider
    model: AssistantModel
    customInstructions: string | null
    documentsDir: string
  }
}

// Default settings with new structure
export const DEFAULT_SETTINGS: Settings = {
  _schemaVersion: CURRENT_SCHEMA_VERSION,
  server: {
    port: 7777,
  },
  paths: {
    defaultGitReposDir: os.homedir(),
  },
  editor: {
    app: 'vscode',
    host: '',
    sshPort: 22,
  },
  integrations: {
    githubPat: null,
    cloudflareApiToken: null,
    cloudflareAccountId: null,
  },
  agent: {
    defaultAgent: 'claude',
    opencodeModel: null,
    opencodeDefaultAgent: 'build',
    opencodePlanAgent: 'plan',
    autoScrollToBottom: true,
  },
  tasks: {
    defaultTaskType: 'worktree',
    startWorktreeTasksImmediately: true,
  },
  appearance: {
    language: null,
    theme: null,
    timezone: null,
    syncClaudeCodeTheme: false,
    claudeCodeLightTheme: 'light-ansi',
    claudeCodeDarkTheme: 'dark-ansi',
  },
  assistant: {
    provider: 'claude',
    model: 'sonnet',
    customInstructions: null,
    documentsDir: '~/.fulcrum/documents',
  },
}

// Old default port for migration detection
export const OLD_DEFAULT_PORT = 3333

// Valid setting paths that can be updated via updateSettingByPath
// This ensures we don't silently write to unknown paths
export const VALID_SETTING_PATHS = new Set([
  'server.port',
  'paths.defaultGitReposDir',
  'editor.app',
  'editor.host',
  'editor.sshPort',
  'integrations.githubPat',
  'integrations.cloudflareApiToken',
  'integrations.cloudflareAccountId',
  'agent.defaultAgent',
  'agent.opencodeModel',
  'agent.opencodeDefaultAgent',
  'agent.opencodePlanAgent',
  'agent.autoScrollToBottom',
  'tasks.defaultTaskType',
  'tasks.startWorktreeTasksImmediately',
  'appearance.language',
  'appearance.theme',
  'appearance.timezone',
  'appearance.syncClaudeCodeTheme',
  'appearance.claudeCodeLightTheme',
  'appearance.claudeCodeDarkTheme',
  'assistant.provider',
  'assistant.model',
  'assistant.customInstructions',
  'assistant.documentsDir',
])

// Legacy flat settings interface for backward compatibility
export interface LegacySettings {
  port: number
  defaultGitReposDir: string
  sshPort: number
  githubPat: string | null
  language: 'en' | 'zh' | null
  theme: 'system' | 'light' | 'dark' | null
  syncClaudeCodeTheme: boolean
  claudeCodeLightTheme: ClaudeCodeTheme
  claudeCodeDarkTheme: ClaudeCodeTheme
}

// Notification settings types
export interface SoundNotificationConfig {
  enabled: boolean
  customSoundFile?: string // Path to user-uploaded sound file
}

export interface ToastNotificationConfig {
  enabled: boolean
}

export interface DesktopNotificationConfig {
  enabled: boolean
}

export interface SlackNotificationConfig {
  enabled: boolean
  webhookUrl?: string
}

export interface DiscordNotificationConfig {
  enabled: boolean
  webhookUrl?: string
}

export interface PushoverNotificationConfig {
  enabled: boolean
  appToken?: string
  userKey?: string
}

export interface NotificationSettings {
  enabled: boolean
  toast: ToastNotificationConfig
  desktop: DesktopNotificationConfig
  sound: SoundNotificationConfig
  slack: SlackNotificationConfig
  discord: DiscordNotificationConfig
  pushover: PushoverNotificationConfig
  _updatedAt?: number // Timestamp for optimistic locking - prevents stale tabs from overwriting settings
}

// Result type for updateNotificationSettings - either success or conflict
export type NotificationSettingsUpdateResult =
  | NotificationSettings
  | { conflict: true; current: NotificationSettings }

// z.ai settings interface
export interface ZAiSettings {
  enabled: boolean
  apiKey: string | null
  haikuModel: string
  sonnetModel: string
  opusModel: string
}

// Migration map from old flat keys to new nested paths
export const MIGRATION_MAP: Record<string, string> = {
  port: 'server.port',
  defaultGitReposDir: 'paths.defaultGitReposDir',
  // remoteHost and hostname are handled specially in migrateSettings (need URL construction)
  sshPort: 'editor.sshPort',
  githubPat: 'integrations.githubPat',
  language: 'appearance.language',
  theme: 'appearance.theme',
  syncClaudeCodeTheme: 'appearance.syncClaudeCodeTheme',
  claudeCodeLightTheme: 'appearance.claudeCodeLightTheme',
  claudeCodeDarkTheme: 'appearance.claudeCodeDarkTheme',
}
