import { drizzle, type BunSQLiteDatabase } from 'drizzle-orm/bun-sqlite'
import { migrate } from 'drizzle-orm/bun-sqlite/migrator'
import { Database } from 'bun:sqlite'
import { join, dirname } from 'node:path'
import { readdirSync, existsSync } from 'node:fs'
import { spawnSync } from 'node:child_process'
import * as schema from './schema'
import { initializeViboraDirectories, getDatabasePath } from '../lib/settings'
import { log } from '../lib/logger'

// Lazy-initialized database instance
let _db: BunSQLiteDatabase<typeof schema> | null = null
let _sqlite: Database | null = null

// Initialize and return the database (lazy initialization)
function initializeDatabase(): BunSQLiteDatabase<typeof schema> {
  if (_db) return _db

  // Initialize all vibora directories (data dir, worktrees, etc.)
  initializeViboraDirectories()

  const dbPath = getDatabasePath()

  // Run schema sync before opening database
  // In bundled mode, migrations are applied after db init
  // In source mode, we run drizzle-kit push before opening
  if (!process.env.VIBORA_PACKAGE_ROOT) {
    runSourceModeSchemaSync(dbPath)
  }

  _sqlite = new Database(dbPath)

  // Enable WAL mode for better performance
  _sqlite.exec('PRAGMA journal_mode = WAL')

  _db = drizzle(_sqlite, { schema })

  // Run migrations in bundled mode (CLI)
  runBundledMigrations(_sqlite, _db)

  return _db
}

// Export a proxy that lazily initializes the database on first access
// This allows tests to set VIBORA_DIR before the database is initialized
export const db = new Proxy({} as BunSQLiteDatabase<typeof schema>, {
  get(_, prop) {
    const instance = initializeDatabase()
    const value = instance[prop as keyof typeof instance]
    if (typeof value === 'function') {
      return value.bind(instance)
    }
    return value
  },
})

// For testing: reset the database instance so a new one can be created
export function resetDatabase(): void {
  if (_sqlite) {
    _sqlite.close()
  }
  _db = null
  _sqlite = null
}

// For testing: get the underlying SQLite instance
export function getSqlite(): Database | null {
  return _sqlite
}

// Run drizzle-kit push in source mode to sync schema
// This ensures database schema is always up-to-date when running from source
function runSourceModeSchemaSync(dbPath: string): void {
  // Find the project root by looking for drizzle.config.ts
  const serverDir = dirname(import.meta.dir)
  const projectRoot = dirname(serverDir)
  const configPath = join(projectRoot, 'drizzle.config.ts')

  if (!existsSync(configPath)) {
    // Not running from source (or config not found), skip
    return
  }

  // Run drizzle-kit push with the correct database path
  const result = spawnSync('bun', ['run', 'drizzle-kit', 'push', '--force'], {
    cwd: projectRoot,
    env: {
      ...process.env,
      VIBORA_DATABASE_PATH: dbPath,
    },
    stdio: ['pipe', 'pipe', 'pipe'],
    timeout: 30000,
  })

  if (result.status !== 0) {
    const stderr = result.stderr?.toString() || ''
    log.db.error('drizzle-kit push failed', { stderr })
  }
}

// Run migrations in bundled mode (lazy, called after db initialization)
function runBundledMigrations(sqlite: Database, drizzleDb: BunSQLiteDatabase<typeof schema>): void {
  if (!process.env.VIBORA_PACKAGE_ROOT) return

  const migrationsPath = join(process.env.VIBORA_PACKAGE_ROOT, 'drizzle')

  // Check if this is a database created with drizzle-kit push (has tables but no migrations recorded).
  // If so, mark existing migrations as applied to avoid "table already exists" errors.
  const hasTasksTable = sqlite
    .query("SELECT name FROM sqlite_master WHERE type='table' AND name='tasks'")
    .get()

  if (hasTasksTable) {
    // Ensure migrations table exists
    sqlite.exec(`
      CREATE TABLE IF NOT EXISTS "__drizzle_migrations" (
        id SERIAL PRIMARY KEY,
        hash text NOT NULL,
        created_at numeric
      )
    `)

    // Check if any migrations are recorded
    const migrationCount = sqlite.query('SELECT COUNT(*) as count FROM __drizzle_migrations').get() as { count: number }

    if (migrationCount.count === 0) {
      // Database was created with drizzle-kit push - mark all migrations as applied
      const files = readdirSync(migrationsPath).filter((f: string) => f.endsWith('.sql')).sort()
      for (const file of files) {
        const hash = file.replace('.sql', '')
        sqlite.exec(`INSERT INTO __drizzle_migrations (hash, created_at) VALUES ('${hash}', ${Date.now()})`)
      }
    }
  }

  migrate(drizzleDb, { migrationsFolder: migrationsPath })
}

// Re-export schema for convenience
export * from './schema'
