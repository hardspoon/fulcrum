import { describe, test, expect, beforeEach, afterEach } from 'bun:test'
import { createTestApp } from '../__tests__/fixtures/app'
import { setupTestEnv, type TestEnv } from '../__tests__/utils/env'

describe('Memory Routes', () => {
  let testEnv: TestEnv

  beforeEach(() => {
    testEnv = setupTestEnv()
  })

  afterEach(() => {
    testEnv.cleanup()
  })

  describe('POST /api/memory', () => {
    test('stores a memory with content only', async () => {
      const { post } = createTestApp()
      const res = await post('/api/memory', { content: 'The user prefers dark mode' })
      const body = await res.json()

      expect(res.status).toBe(201)
      expect(body.id).toBeDefined()
      expect(body.content).toBe('The user prefers dark mode')
      expect(body.tags).toBeNull()
      expect(body.createdAt).toBeDefined()
    })

    test('stores a memory with tags', async () => {
      const { post } = createTestApp()
      const res = await post('/api/memory', {
        content: 'Project uses PostgreSQL for the database',
        tags: ['architecture', 'database'],
      })
      const body = await res.json()

      expect(res.status).toBe(201)
      expect(body.tags).toEqual(['architecture', 'database'])
    })

    test('rejects empty content', async () => {
      const { post } = createTestApp()
      const res = await post('/api/memory', { content: '' })
      expect(res.status).toBe(400)
    })
  })

  describe('GET /api/memory', () => {
    test('lists memories', async () => {
      const { post, get } = createTestApp()
      await post('/api/memory', { content: 'Memory one' })
      await post('/api/memory', { content: 'Memory two' })

      const res = await get('/api/memory')
      const body = await res.json()

      expect(res.status).toBe(200)
      expect(body.memories).toHaveLength(2)
      expect(body.total).toBe(2)
    })

    test('lists memories with limit and offset', async () => {
      const { post, get } = createTestApp()
      await post('/api/memory', { content: 'First' })
      await post('/api/memory', { content: 'Second' })
      await post('/api/memory', { content: 'Third' })

      const res = await get('/api/memory?limit=1&offset=1')
      const body = await res.json()

      expect(res.status).toBe(200)
      expect(body.memories).toHaveLength(1)
      expect(body.total).toBe(3)
    })
  })

  describe('GET /api/memory/search', () => {
    test('searches memories by content', async () => {
      const { post, get } = createTestApp()
      await post('/api/memory', { content: 'The user prefers TypeScript over JavaScript' })
      await post('/api/memory', { content: 'The project uses React for the frontend' })
      await post('/api/memory', { content: 'Database is PostgreSQL with Drizzle ORM' })

      const res = await get('/api/memory/search?q=TypeScript')
      const body = await res.json()

      expect(res.status).toBe(200)
      expect(body).toHaveLength(1)
      expect(body[0].content).toContain('TypeScript')
    })

    test('searches with tag filtering', async () => {
      const { post, get } = createTestApp()
      await post('/api/memory', {
        content: 'Use ESLint for linting',
        tags: ['tooling'],
      })
      await post('/api/memory', {
        content: 'Use Prettier for formatting',
        tags: ['tooling'],
      })
      await post('/api/memory', {
        content: 'Deploy using Docker',
        tags: ['deployment'],
      })

      const res = await get('/api/memory/search?q=use&tags=tooling')
      const body = await res.json()

      expect(res.status).toBe(200)
      expect(body).toHaveLength(2)
    })

    test('rejects missing query', async () => {
      const { get } = createTestApp()
      const res = await get('/api/memory/search')
      expect(res.status).toBe(400)
    })
  })

  describe('DELETE /api/memory/:id', () => {
    test('deletes a memory', async () => {
      const { post, delete: del, get } = createTestApp()
      const createRes = await post('/api/memory', { content: 'Temporary memory' })
      const created = await createRes.json()

      const deleteRes = await del(`/api/memory/${created.id}`)
      expect(deleteRes.status).toBe(200)

      const listRes = await get('/api/memory')
      const listBody = await listRes.json()
      expect(listBody.memories).toHaveLength(0)
    })

    test('returns 404 for non-existent memory', async () => {
      const { delete: del } = createTestApp()
      const res = await del('/api/memory/nonexistent')
      expect(res.status).toBe(404)
    })
  })

  describe('FTS5 integration', () => {
    test('supports phrase matching', async () => {
      const { post, get } = createTestApp()
      await post('/api/memory', { content: 'The dark mode theme is preferred' })
      await post('/api/memory', { content: 'Prefer light theme for documents' })

      const res = await get('/api/memory/search?q=%22dark+mode%22')
      const body = await res.json()

      expect(res.status).toBe(200)
      expect(body).toHaveLength(1)
      expect(body[0].content).toContain('dark mode')
    })

    test('FTS5 stays in sync after delete', async () => {
      const { post, get, delete: del } = createTestApp()
      const createRes = await post('/api/memory', { content: 'Unique searchable content xyz123' })
      const created = await createRes.json()

      // Verify it's searchable
      let searchRes = await get('/api/memory/search?q=xyz123')
      let searchBody = await searchRes.json()
      expect(searchBody).toHaveLength(1)

      // Delete it
      await del(`/api/memory/${created.id}`)

      // Verify it's no longer searchable
      searchRes = await get('/api/memory/search?q=xyz123')
      searchBody = await searchRes.json()
      expect(searchBody).toHaveLength(0)
    })
  })
})
