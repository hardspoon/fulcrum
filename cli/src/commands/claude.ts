import { mkdirSync, writeFileSync, existsSync, rmSync, readFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { join } from 'node:path'
import { CliError, ExitCodes } from '../utils/errors'

// Plugin bundle: import all files as text using Bun
// @ts-expect-error - Bun text import
import PLUGIN_JSON from '../../../plugins/fulcrum/.claude-plugin/plugin.json' with { type: 'text' }
// @ts-expect-error - Bun text import
import HOOKS_JSON from '../../../plugins/fulcrum/hooks/hooks.json' with { type: 'text' }
// @ts-expect-error - Bun text import
import MCP_JSON from '../../../plugins/fulcrum/.mcp.json' with { type: 'text' }
// @ts-expect-error - Bun text import
import CMD_PR from '../../../plugins/fulcrum/commands/pr.md' with { type: 'text' }
// @ts-expect-error - Bun text import
import CMD_TASK_INFO from '../../../plugins/fulcrum/commands/task-info.md' with { type: 'text' }
// @ts-expect-error - Bun text import
import CMD_NOTIFY from '../../../plugins/fulcrum/commands/notify.md' with { type: 'text' }
// @ts-expect-error - Bun text import
import CMD_LINEAR from '../../../plugins/fulcrum/commands/linear.md' with { type: 'text' }
// @ts-expect-error - Bun text import
import CMD_REVIEW from '../../../plugins/fulcrum/commands/review.md' with { type: 'text' }
// @ts-expect-error - Bun text import
import SKILL_VIBORA from '../../../plugins/fulcrum/skills/vibora/SKILL.md' with { type: 'text' }

// Plugin location: ~/.claude/plugins/fulcrum/
const PLUGIN_DIR = join(homedir(), '.claude', 'plugins', 'fulcrum')

// Plugin file structure to create
const PLUGIN_FILES: Array<{ path: string; content: string }> = [
  { path: '.claude-plugin/plugin.json', content: PLUGIN_JSON },
  { path: 'hooks/hooks.json', content: HOOKS_JSON },
  { path: '.mcp.json', content: MCP_JSON },
  { path: 'commands/pr.md', content: CMD_PR },
  { path: 'commands/task-info.md', content: CMD_TASK_INFO },
  { path: 'commands/notify.md', content: CMD_NOTIFY },
  { path: 'commands/linear.md', content: CMD_LINEAR },
  { path: 'commands/review.md', content: CMD_REVIEW },
  { path: 'skills/vibora/SKILL.md', content: SKILL_VIBORA },
]

// Plugin registration constants
const PLUGIN_ID = 'fulcrum@fulcrum'
const INSTALLED_PLUGINS_PATH = join(homedir(), '.claude', 'plugins', 'installed_plugins.json')
const CLAUDE_SETTINGS_PATH = join(homedir(), '.claude', 'settings.json')

// Get plugin version from the bundled plugin.json
function getPluginVersion(): string {
  try {
    const parsed = JSON.parse(PLUGIN_JSON)
    return parsed.version || '1.0.0'
  } catch {
    return '1.0.0'
  }
}

// Register plugin in installed_plugins.json
function registerPlugin(): void {
  const version = getPluginVersion()
  const now = new Date().toISOString()

  let data: { version: number; plugins: Record<string, unknown[]> } = { version: 2, plugins: {} }
  if (existsSync(INSTALLED_PLUGINS_PATH)) {
    try {
      data = JSON.parse(readFileSync(INSTALLED_PLUGINS_PATH, 'utf-8'))
    } catch {
      // If file is corrupt, start fresh
    }
  }

  data.plugins = data.plugins || {}
  data.plugins[PLUGIN_ID] = [
    {
      scope: 'user',
      installPath: PLUGIN_DIR,
      version,
      installedAt: now,
      lastUpdated: now,
    },
  ]

  // Ensure directory exists
  const dir = INSTALLED_PLUGINS_PATH.substring(0, INSTALLED_PLUGINS_PATH.lastIndexOf('/'))
  mkdirSync(dir, { recursive: true })
  writeFileSync(INSTALLED_PLUGINS_PATH, JSON.stringify(data, null, 2), 'utf-8')
}

// Enable plugin in settings.json
function enablePlugin(): void {
  let data: Record<string, unknown> = {}
  if (existsSync(CLAUDE_SETTINGS_PATH)) {
    try {
      data = JSON.parse(readFileSync(CLAUDE_SETTINGS_PATH, 'utf-8'))
    } catch {
      // If file is corrupt, start fresh
    }
  }

  const enabledPlugins = (data.enabledPlugins as Record<string, boolean>) || {}
  enabledPlugins[PLUGIN_ID] = true
  data.enabledPlugins = enabledPlugins

  // Ensure directory exists
  const dir = CLAUDE_SETTINGS_PATH.substring(0, CLAUDE_SETTINGS_PATH.lastIndexOf('/'))
  mkdirSync(dir, { recursive: true })
  writeFileSync(CLAUDE_SETTINGS_PATH, JSON.stringify(data, null, 2), 'utf-8')
}

// Unregister plugin from installed_plugins.json
function unregisterPlugin(): void {
  if (!existsSync(INSTALLED_PLUGINS_PATH)) return

  try {
    const data = JSON.parse(readFileSync(INSTALLED_PLUGINS_PATH, 'utf-8'))
    if (data.plugins && data.plugins[PLUGIN_ID]) {
      delete data.plugins[PLUGIN_ID]
      writeFileSync(INSTALLED_PLUGINS_PATH, JSON.stringify(data, null, 2), 'utf-8')
    }
  } catch {
    // Ignore errors when cleaning up
  }
}

// Disable plugin in settings.json
function disablePlugin(): void {
  if (!existsSync(CLAUDE_SETTINGS_PATH)) return

  try {
    const data = JSON.parse(readFileSync(CLAUDE_SETTINGS_PATH, 'utf-8'))
    if (data.enabledPlugins && data.enabledPlugins[PLUGIN_ID] !== undefined) {
      delete data.enabledPlugins[PLUGIN_ID]
      writeFileSync(CLAUDE_SETTINGS_PATH, JSON.stringify(data, null, 2), 'utf-8')
    }
  } catch {
    // Ignore errors when cleaning up
  }
}

export async function handleClaudeCommand(action: string | undefined) {
  if (action === 'install') {
    await installClaudePlugin()
    return
  }

  if (action === 'uninstall') {
    await uninstallClaudePlugin()
    return
  }

  throw new CliError(
    'INVALID_ACTION',
    'Unknown action. Usage: fulcrum claude install | fulcrum claude uninstall',
    ExitCodes.INVALID_ARGS
  )
}

// Check if plugin needs to be installed or updated
export function needsPluginUpdate(): boolean {
  const installedPluginJson = join(PLUGIN_DIR, '.claude-plugin', 'plugin.json')
  if (!existsSync(installedPluginJson)) {
    return true // Not installed
  }

  try {
    const installed = JSON.parse(readFileSync(installedPluginJson, 'utf-8'))
    const bundled = JSON.parse(PLUGIN_JSON)
    return installed.version !== bundled.version
  } catch {
    return true // Can't read, assume needs update
  }
}

export async function installClaudePlugin(options: { silent?: boolean } = {}) {
  const { silent = false } = options
  const log = silent ? () => {} : console.log

  try {
    log('Installing Claude Code plugin...')

    // Remove existing installation if present
    if (existsSync(PLUGIN_DIR)) {
      log('• Removing existing plugin installation...')
      rmSync(PLUGIN_DIR, { recursive: true })
    }

    // Create plugin directory structure and write files
    for (const file of PLUGIN_FILES) {
      const fullPath = join(PLUGIN_DIR, file.path)
      const dir = fullPath.substring(0, fullPath.lastIndexOf('/'))
      mkdirSync(dir, { recursive: true })
      writeFileSync(fullPath, file.content, 'utf-8')
    }

    log('✓ Installed plugin files at ' + PLUGIN_DIR)

    // Register and enable the plugin
    registerPlugin()
    log('✓ Registered plugin in installed_plugins.json')

    enablePlugin()
    log('✓ Enabled plugin in settings.json')

    log('')
    log('Installation complete! Restart Claude Code to apply changes.')
  } catch (err) {
    throw new CliError(
      'INSTALL_FAILED',
      `Failed to install Claude plugin: ${err instanceof Error ? err.message : String(err)}`,
      ExitCodes.ERROR
    )
  }
}

async function uninstallClaudePlugin() {
  try {
    let didSomething = false

    // Remove plugin files
    if (existsSync(PLUGIN_DIR)) {
      rmSync(PLUGIN_DIR, { recursive: true })
      console.log('✓ Removed plugin files from ' + PLUGIN_DIR)
      didSomething = true
    }

    // Unregister from installed_plugins.json
    unregisterPlugin()
    console.log('✓ Unregistered plugin from installed_plugins.json')

    // Disable in settings.json
    disablePlugin()
    console.log('✓ Disabled plugin in settings.json')

    if (didSomething) {
      console.log('')
      console.log('Uninstall complete! Restart Claude Code to apply changes.')
    } else {
      console.log('')
      console.log('Plugin files were not found, but registration entries have been cleaned up.')
    }
  } catch (err) {
    throw new CliError(
      'UNINSTALL_FAILED',
      `Failed to uninstall Claude plugin: ${err instanceof Error ? err.message : String(err)}`,
      ExitCodes.ERROR
    )
  }
}
