// Tests for assistant routes - session creation, provider routing, message handling
import { describe, test, expect, beforeEach, afterEach } from 'bun:test'
import { createTestApp } from '../__tests__/fixtures/app'
import { setupTestEnv, type TestEnv } from '../__tests__/utils/env'

describe('Assistant Routes', () => {
  let testEnv: TestEnv

  beforeEach(() => {
    testEnv = setupTestEnv()
  })

  afterEach(() => {
    testEnv.cleanup()
  })

  describe('POST /api/assistant/sessions', () => {
    test('creates a claude session by default', async () => {
      const { post } = createTestApp()
      const res = await post('/api/assistant/sessions', { title: 'Test Chat' })
      const body = await res.json()

      expect(res.status).toBe(200)
      expect(body.id).toBeDefined()
      expect(body.title).toBe('Test Chat')
      expect(body.provider).toBe('claude')
    })

    test('creates an opencode session when specified', async () => {
      const { post } = createTestApp()
      const res = await post('/api/assistant/sessions', {
        title: 'OpenCode Chat',
        provider: 'opencode',
      })
      const body = await res.json()

      expect(res.status).toBe(200)
      expect(body.id).toBeDefined()
      expect(body.provider).toBe('opencode')
    })

    test('creates session without title', async () => {
      const { post } = createTestApp()
      const res = await post('/api/assistant/sessions', {})
      const body = await res.json()

      expect(res.status).toBe(200)
      expect(body.id).toBeDefined()
      expect(body.title).toBe('New Chat')
    })
  })

  describe('GET /api/assistant/sessions/:id', () => {
    test('returns session with messages', async () => {
      const { post, get } = createTestApp()

      // Create a session
      const createRes = await post('/api/assistant/sessions', { title: 'Test' })
      const { id } = await createRes.json()

      // Get it back
      const res = await get(`/api/assistant/sessions/${id}`)
      const body = await res.json()

      expect(res.status).toBe(200)
      expect(body.id).toBe(id)
      expect(body.messages).toBeDefined()
      expect(Array.isArray(body.messages)).toBe(true)
    })

    test('returns 404 for non-existent session', async () => {
      const { get } = createTestApp()
      const res = await get('/api/assistant/sessions/nonexistent')
      expect(res.status).toBe(404)
    })

    test('includes provider field in session response', async () => {
      const { post, get } = createTestApp()

      const createRes = await post('/api/assistant/sessions', {
        title: 'Test',
        provider: 'opencode',
      })
      const { id } = await createRes.json()

      const res = await get(`/api/assistant/sessions/${id}`)
      const body = await res.json()

      expect(body.provider).toBe('opencode')
    })
  })

  describe('GET /api/assistant/sessions', () => {
    test('lists sessions with pagination', async () => {
      const { post, get } = createTestApp()

      // Create a few sessions
      await post('/api/assistant/sessions', { title: 'Session 1' })
      await post('/api/assistant/sessions', { title: 'Session 2' })

      const res = await get('/api/assistant/sessions')
      const body = await res.json()

      expect(res.status).toBe(200)
      expect(body.sessions).toBeDefined()
      expect(body.sessions.length).toBeGreaterThanOrEqual(2)
    })
  })

  describe('DELETE /api/assistant/sessions/:id', () => {
    test('deletes an existing session', async () => {
      const { post, request, get } = createTestApp()

      const createRes = await post('/api/assistant/sessions', { title: 'To Delete' })
      const { id } = await createRes.json()

      const deleteRes = await request(`/api/assistant/sessions/${id}`, { method: 'DELETE' })
      expect(deleteRes.status).toBe(200)

      // Verify it's gone
      const getRes = await get(`/api/assistant/sessions/${id}`)
      expect(getRes.status).toBe(404)
    })

    test('returns 404 for non-existent session', async () => {
      const { request } = createTestApp()
      const res = await request('/api/assistant/sessions/nonexistent', { method: 'DELETE' })
      expect(res.status).toBe(404)
    })
  })

  describe('POST /api/assistant/sessions/:id/messages', () => {
    test('returns 400 when message and images are both missing', async () => {
      const { post } = createTestApp()

      const sessionRes = await post('/api/assistant/sessions', { title: 'Test' })
      const { id } = await sessionRes.json()

      const res = await post(`/api/assistant/sessions/${id}/messages`, {})
      expect(res.status).toBe(400)
    })

    test('returns 404 for non-existent session', async () => {
      const { post } = createTestApp()
      const res = await post('/api/assistant/sessions/nonexistent/messages', {
        message: 'hello',
      })
      expect(res.status).toBe(404)
    })
  })

  describe('PATCH /api/assistant/sessions/:id', () => {
    test('updates session title', async () => {
      const { post, request, get } = createTestApp()

      const createRes = await post('/api/assistant/sessions', { title: 'Original' })
      const { id } = await createRes.json()

      const patchRes = await request(`/api/assistant/sessions/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: 'Updated Title' }),
      })
      expect(patchRes.status).toBe(200)

      const getRes = await get(`/api/assistant/sessions/${id}`)
      const body = await getRes.json()
      expect(body.title).toBe('Updated Title')
    })

    test('returns 404 for non-existent session', async () => {
      const { request } = createTestApp()
      const res = await request('/api/assistant/sessions/nonexistent', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: 'new' }),
      })
      expect(res.status).toBe(404)
    })
  })
})
