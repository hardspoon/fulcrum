import { describe, test, expect, beforeEach, afterEach } from 'bun:test'
import { setupTestEnv, type TestEnv } from '../__tests__/utils/env'
import { createTestApp, type TestAppClient } from '../__tests__/fixtures/app'
import { db } from '../db'
import { sql } from 'drizzle-orm'

describe('Search Routes', () => {
  let testEnv: TestEnv
  let client: TestAppClient

  beforeEach(() => {
    testEnv = setupTestEnv()
    client = createTestApp()
  })

  afterEach(() => {
    testEnv.cleanup()
  })

  function insertTask(id: string, title: string, description: string | null = null) {
    const now = new Date().toISOString()
    db.run(sql`INSERT INTO tasks (id, title, description, status, position, created_at, updated_at)
      VALUES (${id}, ${title}, ${description}, ${'IN_PROGRESS'}, 0, ${now}, ${now})`)
  }

  function insertMemory(id: string, content: string) {
    const now = new Date().toISOString()
    db.run(sql`INSERT INTO memories (id, content, created_at, updated_at)
      VALUES (${id}, ${content}, ${now}, ${now})`)
  }

  describe('GET /api/search', () => {
    test('returns 400 without query parameter', async () => {
      const res = await client.get('/api/search')
      expect(res.status).toBe(400)
    })

    test('returns results for matching query', async () => {
      insertTask('t1', 'Deploy Kubernetes cluster')
      insertMemory('m1', 'Kubernetes runs on port 6443')

      const res = await client.get('/api/search?q=kubernetes')
      expect(res.status).toBe(200)

      const results = await res.json()
      expect(results.length).toBeGreaterThanOrEqual(2)
    })

    test('filters by entity type', async () => {
      insertTask('t1', 'Deploy service')
      insertMemory('m1', 'Deploy process documented here')

      const res = await client.get('/api/search?q=deploy&entities=tasks')
      expect(res.status).toBe(200)

      const results = await res.json()
      expect(results.every((r: { entityType: string }) => r.entityType === 'task')).toBe(true)
    })

    test('respects limit parameter', async () => {
      for (let i = 0; i < 5; i++) {
        insertTask(`t${i}`, `Service task ${i}`)
      }

      const res = await client.get('/api/search?q=service&limit=2')
      expect(res.status).toBe(200)

      const results = await res.json()
      // Limit is per-entity, but we only have tasks here
      expect(results.length).toBeLessThanOrEqual(2)
    })

    test('returns empty array for no matches', async () => {
      const res = await client.get('/api/search?q=nonexistentterm12345')
      expect(res.status).toBe(200)

      const results = await res.json()
      expect(results).toHaveLength(0)
    })
  })
})
