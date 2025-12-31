import { getZAiSettings } from './settings'

// Server-specific env vars to filter from spawned shells
const SERVER_ENV_VARS = [
  'DEBUG',
  'LOG_LEVEL',
  'VITE_LOG_LEVEL',
  'VIBORA_PACKAGE_ROOT',
  'VIBORA_DEVELOPER',
  'HOST',
  'VIBORA_DIR',
  'BUN_PTY_LIB',
]

// z.ai related env vars to filter when z.ai is disabled
const ZAI_ENV_VARS = [
  'ANTHROPIC_AUTH_TOKEN',
  'ANTHROPIC_BASE_URL',
  'API_TIMEOUT_MS',
  'ANTHROPIC_DEFAULT_HAIKU_MODEL',
  'ANTHROPIC_DEFAULT_SONNET_MODEL',
  'ANTHROPIC_DEFAULT_OPUS_MODEL',
  'CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC',
]

/**
 * Get a clean environment for spawned shells, filtering out:
 * - Server-specific vars (DEBUG, LOG_LEVEL, etc.)
 * - PORT and NODE_ENV
 * - z.ai vars when z.ai is disabled
 */
export function getShellEnv(): Record<string, string> {
  const { PORT: _PORT, NODE_ENV: _NODE_ENV, ...envWithoutFiltered } = process.env
  void _PORT
  void _NODE_ENV

  // Filter out server-specific env vars
  const filtered: Record<string, string> = {}
  for (const [key, value] of Object.entries(envWithoutFiltered)) {
    if (!SERVER_ENV_VARS.includes(key) && value !== undefined) {
      filtered[key] = value
    }
  }

  // Also filter z.ai vars if disabled
  const zaiSettings = getZAiSettings()
  if (zaiSettings.enabled) {
    return filtered
  }

  const result: Record<string, string> = {}
  for (const [key, value] of Object.entries(filtered)) {
    if (!ZAI_ENV_VARS.includes(key)) {
      result[key] = value
    }
  }
  return result
}
