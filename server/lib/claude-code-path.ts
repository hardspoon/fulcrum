import { execSync } from 'node:child_process'
import { existsSync } from 'node:fs'
import { join } from 'node:path'
import { homedir } from 'node:os'
import { getSetting } from './settings'
import { log } from './logger'

/**
 * Find the Claude Code executable path.
 *
 * Detection order:
 * 1. Manual override from settings (agent.claudeCodePath)
 * 2. PATH lookup (which claude)
 * 3. Common installation paths
 * 4. Global npm installation
 *
 * @returns Object with path (if found) and source describing where it was found
 */
export function findClaudeCodePath(): { path: string | null; source: string | null } {
  // 1. Check manual override from settings
  const settingsPath = getSetting('agent.claudeCodePath') as string | null
  if (settingsPath && existsSync(settingsPath)) {
    return { path: settingsPath, source: 'settings' }
  }

  // 2. Check PATH
  try {
    const pathResult = execSync('which claude', { encoding: 'utf-8', stdio: ['pipe', 'pipe', 'pipe'] }).trim()
    if (pathResult && existsSync(pathResult)) {
      return { path: pathResult, source: 'PATH' }
    }
  } catch {
    // Not found in PATH, continue
  }

  // 3. Check common installation paths
  const home = homedir()
  const commonPaths = [
    join(home, '.claude', 'local', 'claude'), // curl installer
    join(home, '.local', 'bin', 'claude'), // Linux local bin
    '/usr/local/bin/claude',
    '/opt/homebrew/bin/claude', // macOS Homebrew
  ]

  for (const path of commonPaths) {
    if (existsSync(path)) {
      return { path, source: 'common-path' }
    }
  }

  // 4. Check global npm installation
  try {
    const npmRoot = execSync('npm root -g', { encoding: 'utf-8', stdio: ['pipe', 'pipe', 'pipe'] }).trim()
    const npmClaude = join(npmRoot, '@anthropic-ai', 'claude-code', 'cli.js')
    if (existsSync(npmClaude)) {
      return { path: npmClaude, source: 'npm-global' }
    }
  } catch {
    // npm not available or failed
  }

  return { path: null, source: null }
}

/**
 * Get the Claude Code path for the SDK's pathToClaudeCodeExecutable option.
 * Returns undefined if not found or if using default PATH lookup.
 *
 * This function is optimized for the SDK - it only returns a path when
 * we need to override the default behavior (when Claude isn't in PATH).
 */
export function getClaudeCodePathForSdk(): string | undefined {
  const result = findClaudeCodePath()

  if (!result.path) {
    log.claude.debug('Claude Code executable not found')
    return undefined
  }

  // If found in PATH, SDK will find it automatically - no need to specify
  if (result.source === 'PATH') {
    log.claude.debug('Claude Code found in PATH, using default resolution')
    return undefined
  }

  // For all other sources, we need to tell the SDK where to find it
  log.claude.debug('Claude Code found via custom path', { path: result.path, source: result.source })
  return result.path
}
