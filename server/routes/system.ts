import { Hono } from 'hono'
import { execSync } from 'node:child_process'

const app = new Hono()

/**
 * Check if a command is available in PATH
 */
function isCommandAvailable(command: string): { installed: boolean; path?: string } {
  try {
    const path = execSync(`which ${command}`, { encoding: 'utf-8' }).trim()
    return { installed: true, path }
  } catch {
    return { installed: false }
  }
}

/**
 * GET /api/system/dependencies
 * Returns the status of required and optional dependencies
 */
app.get('/dependencies', (c) => {
  // Check for Claude Code CLI
  // The CLI performs alias-aware detection before starting the server.
  // Since the server runs as a daemon without access to shell aliases,
  // we trust the CLI's detection passed via environment variable.
  const claudeInstalledFromEnv = process.env.VIBORA_CLAUDE_INSTALLED === '1'
  const claudeMissingFromEnv = process.env.VIBORA_CLAUDE_MISSING === '1'
  const claudeCheck = claudeInstalledFromEnv
    ? { installed: true }
    : claudeMissingFromEnv
      ? { installed: false }
      : isCommandAvailable('claude')

  // Check for dtach (should always be installed if we got here, but check anyway)
  const dtachCheck = isCommandAvailable('dtach')

  return c.json({
    claudeCode: claudeCheck,
    dtach: dtachCheck,
  })
})

export default app
