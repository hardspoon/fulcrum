import { CURRENT_SCHEMA_VERSION, MIGRATION_MAP, OLD_DEFAULT_PORT, type TaskType } from './types'

// Helper: Get nested value from object using dot notation
export function getNestedValue(obj: Record<string, unknown>, path: string): unknown {
  return path.split('.').reduce((o, k) => {
    if (o && typeof o === 'object') {
      return (o as Record<string, unknown>)[k]
    }
    return undefined
  }, obj as unknown)
}

// Helper: Set nested value in object using dot notation
export function setNestedValue(obj: Record<string, unknown>, path: string, value: unknown): void {
  const keys = path.split('.')
  const lastKey = keys.pop()!
  let current = obj

  for (const key of keys) {
    if (!(key in current) || typeof current[key] !== 'object' || current[key] === null) {
      current[key] = {}
    }
    current = current[key] as Record<string, unknown>
  }

  current[lastKey] = value
}

export interface MigrationResult {
  migrated: boolean
  migratedKeys: string[]
  warnings: string[]
}

// Migrate flat settings to nested structure
export function migrateSettings(parsed: Record<string, unknown>): MigrationResult {
  const result: MigrationResult = { migrated: false, migratedKeys: [], warnings: [] }

  // Check schema version - skip if already migrated
  // If no _schemaVersion exists, it's a legacy file that needs migration (use 0)
  const version = (parsed._schemaVersion as number) ?? 0
  if (version >= CURRENT_SCHEMA_VERSION) {
    return result
  }

  // Migrate legacy flat keys to nested structure (for files without schema version)
  if (version < CURRENT_SCHEMA_VERSION) {
    for (const [oldKey, newPath] of Object.entries(MIGRATION_MAP)) {
      // Check if old flat key exists
      if (oldKey in parsed && parsed[oldKey] !== undefined) {
        const oldValue = parsed[oldKey]

        // Special case: don't migrate old default port - let users get the new default
        if (oldKey === 'port' && oldValue === OLD_DEFAULT_PORT) {
          delete parsed[oldKey]
          result.migrated = true
          continue
        }

        // Check if new nested path already has a value (partial migration)
        const existingValue = getNestedValue(parsed, newPath)

        if (existingValue !== undefined) {
          // New path already has value - prefer new, log warning
          result.warnings.push(`Key "${oldKey}" exists but "${newPath}" already set. Removing old key.`)
        } else {
          // Migrate value to new nested path
          setNestedValue(parsed, newPath, oldValue)
          result.migratedKeys.push(oldKey)
        }

        // Remove old flat key
        delete parsed[oldKey]
        result.migrated = true
      }
    }

    // Clean up old remote settings if present (no longer used)
    delete parsed.remoteHost
    delete parsed.hostname
    delete parsed.remoteFulcrum
  }

  // Set schema version
  parsed._schemaVersion = CURRENT_SCHEMA_VERSION
  result.migrated = true

  return result
}

// Migrate old task type values ('code' -> 'worktree', 'non-code' -> 'non-worktree')
export function migrateTaskType(value: string | undefined): TaskType | undefined {
  if (!value) return undefined
  if (value === 'code') return 'worktree'
  if (value === 'non-code') return 'non-worktree'
  return value as TaskType
}

// Helper: Deep merge user settings with defaults, preserving user values
// User values take precedence; missing keys are filled from defaults
// Extra keys in user settings (not in defaults) are preserved
export function deepMergeWithDefaults(
  userSettings: Record<string, unknown>,
  defaults: Record<string, unknown>
): Record<string, unknown> {
  const result: Record<string, unknown> = {}

  // Start with all keys from defaults
  for (const key of Object.keys(defaults)) {
    const defaultValue = defaults[key]
    const userValue = userSettings[key]

    if (defaultValue !== null && typeof defaultValue === 'object' && !Array.isArray(defaultValue)) {
      // Recurse for nested objects
      result[key] = deepMergeWithDefaults(
        (userValue as Record<string, unknown>) ?? {},
        defaultValue as Record<string, unknown>
      )
    } else if (userValue !== undefined) {
      // User value exists, use it (even if null)
      result[key] = userValue
    } else {
      // Use default
      result[key] = defaultValue
    }
  }

  // Preserve any extra keys from user settings (e.g., desktop.zoomLevel, lastUpdateCheck)
  for (const key of Object.keys(userSettings)) {
    if (!(key in result)) {
      result[key] = userSettings[key]
    }
  }

  return result
}
