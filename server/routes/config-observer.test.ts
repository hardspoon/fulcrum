// Tests for observer-related config validation (new settings added in this branch)
import { describe, test, expect, beforeEach, afterEach } from 'bun:test'
import { createTestApp } from '../__tests__/fixtures/app'
import { setupTestEnv, type TestEnv } from '../__tests__/utils/env'

describe('Config Routes - Observer Settings', () => {
  let testEnv: TestEnv

  beforeEach(() => {
    testEnv = setupTestEnv()
  })

  afterEach(() => {
    testEnv.cleanup()
  })

  describe('PUT /api/config/assistant.observerProvider', () => {
    test('accepts "claude" as valid provider', async () => {
      const { put } = createTestApp()
      const res = await put('/api/config/assistant.observerProvider', { value: 'claude' })
      expect(res.status).toBe(200)
      const body = await res.json()
      expect(body.value).toBe('claude')
    })

    test('accepts "opencode" as valid provider', async () => {
      const { put } = createTestApp()
      const res = await put('/api/config/assistant.observerProvider', { value: 'opencode' })
      expect(res.status).toBe(200)
      const body = await res.json()
      expect(body.value).toBe('opencode')
    })

    test('accepts null (use main provider)', async () => {
      const { put } = createTestApp()
      const res = await put('/api/config/assistant.observerProvider', { value: null })
      expect(res.status).toBe(200)
      const body = await res.json()
      expect(body.value).toBe(null)
    })

    test('rejects empty string (fails validation before null conversion)', async () => {
      const { put } = createTestApp()
      // Empty string hits the validation check (not null, not 'claude', not 'opencode') before
      // reaching the empty-string-to-null conversion, so it returns 400
      const res = await put('/api/config/assistant.observerProvider', { value: '' })
      expect(res.status).toBe(400)
    })

    test('rejects invalid provider value', async () => {
      const { put } = createTestApp()
      const res = await put('/api/config/assistant.observerProvider', { value: 'invalid' })
      expect(res.status).toBe(400)
      const body = await res.json()
      expect(body.error).toContain('Observer provider')
    })

    test('rejects numeric value', async () => {
      const { put } = createTestApp()
      const res = await put('/api/config/assistant.observerProvider', { value: 123 })
      expect(res.status).toBe(400)
    })
  })

  describe('PUT /api/config/assistant.observerOpencodeModel', () => {
    test('accepts a model string', async () => {
      const { put } = createTestApp()
      const res = await put('/api/config/assistant.observerOpencodeModel', { value: 'anthropic/claude-sonnet-4-5' })
      expect(res.status).toBe(200)
      const body = await res.json()
      expect(body.value).toBe('anthropic/claude-sonnet-4-5')
    })

    test('accepts null', async () => {
      const { put } = createTestApp()
      const res = await put('/api/config/assistant.observerOpencodeModel', { value: null })
      expect(res.status).toBe(200)
      const body = await res.json()
      expect(body.value).toBe(null)
    })

    test('converts empty string to null', async () => {
      const { put, get } = createTestApp()
      const res = await put('/api/config/assistant.observerOpencodeModel', { value: '' })
      expect(res.status).toBe(200)

      const checkRes = await get('/api/config/assistant.observerOpencodeModel')
      const checkBody = await checkRes.json()
      expect(checkBody.value).toBe(null)
    })

    test('rejects non-string, non-null value', async () => {
      const { put } = createTestApp()
      const res = await put('/api/config/assistant.observerOpencodeModel', { value: 123 })
      expect(res.status).toBe(400)
      const body = await res.json()
      expect(body.error).toContain('Observer OpenCode model')
    })

    test('accepts various model string formats', async () => {
      const { put } = createTestApp()

      // Standard provider/model format
      const res1 = await put('/api/config/assistant.observerOpencodeModel', { value: 'anthropic/claude-haiku-4-5' })
      expect(res1.status).toBe(200)

      // Multi-segment model ID (openrouter style)
      const res2 = await put('/api/config/assistant.observerOpencodeModel', { value: 'openrouter/z-ai/glm-4.7' })
      expect(res2.status).toBe(200)
    })
  })

  describe('PUT /api/config/agent.opencodeModel', () => {
    test('accepts a model string', async () => {
      const { put } = createTestApp()
      const res = await put('/api/config/agent.opencodeModel', { value: 'anthropic/claude-opus-4-5' })
      expect(res.status).toBe(200)
      const body = await res.json()
      expect(body.value).toBe('anthropic/claude-opus-4-5')
    })

    test('accepts null', async () => {
      const { put } = createTestApp()
      const res = await put('/api/config/agent.opencodeModel', { value: null })
      expect(res.status).toBe(200)
      const body = await res.json()
      expect(body.value).toBe(null)
    })

    test('converts empty string to null', async () => {
      const { put, get } = createTestApp()
      await put('/api/config/agent.opencodeModel', { value: '' })

      const checkRes = await get('/api/config/agent.opencodeModel')
      const checkBody = await checkRes.json()
      expect(checkBody.value).toBe(null)
    })

    test('rejects non-string, non-null value', async () => {
      const { put } = createTestApp()
      const res = await put('/api/config/agent.opencodeModel', { value: 42 })
      expect(res.status).toBe(400)
      const body = await res.json()
      expect(body.error).toContain('OpenCode model')
    })
  })

  describe('PUT /api/config/agent.opencodeDefaultAgent', () => {
    test('accepts valid agent name', async () => {
      const { put } = createTestApp()
      const res = await put('/api/config/agent.opencodeDefaultAgent', { value: 'build' })
      expect(res.status).toBe(200)
      const body = await res.json()
      expect(body.value).toBe('build')
    })

    test('trims whitespace', async () => {
      const { put } = createTestApp()
      const res = await put('/api/config/agent.opencodeDefaultAgent', { value: '  build  ' })
      expect(res.status).toBe(200)
      const body = await res.json()
      expect(body.value).toBe('build')
    })

    test('rejects empty string', async () => {
      const { put } = createTestApp()
      const res = await put('/api/config/agent.opencodeDefaultAgent', { value: '' })
      expect(res.status).toBe(400)
      const body = await res.json()
      expect(body.error).toContain('non-empty string')
    })

    test('rejects whitespace-only string', async () => {
      const { put } = createTestApp()
      const res = await put('/api/config/agent.opencodeDefaultAgent', { value: '   ' })
      expect(res.status).toBe(400)
    })
  })

  describe('PUT /api/config/agent.opencodePlanAgent', () => {
    test('accepts valid agent name', async () => {
      const { put } = createTestApp()
      const res = await put('/api/config/agent.opencodePlanAgent', { value: 'plan' })
      expect(res.status).toBe(200)
      const body = await res.json()
      expect(body.value).toBe('plan')
    })

    test('rejects empty string', async () => {
      const { put } = createTestApp()
      const res = await put('/api/config/agent.opencodePlanAgent', { value: '' })
      expect(res.status).toBe(400)
    })
  })

  describe('PUT /api/config/assistant.provider', () => {
    test('accepts "claude"', async () => {
      const { put } = createTestApp()
      const res = await put('/api/config/assistant.provider', { value: 'claude' })
      expect(res.status).toBe(200)
    })

    test('accepts "opencode"', async () => {
      const { put } = createTestApp()
      const res = await put('/api/config/assistant.provider', { value: 'opencode' })
      expect(res.status).toBe(200)
    })

    test('rejects invalid provider', async () => {
      const { put } = createTestApp()
      const res = await put('/api/config/assistant.provider', { value: 'gpt' })
      expect(res.status).toBe(400)
      const body = await res.json()
      expect(body.error).toContain('must be one of')
    })
  })

  describe('PUT /api/config/assistant.model', () => {
    test('accepts "opus"', async () => {
      const { put } = createTestApp()
      const res = await put('/api/config/assistant.model', { value: 'opus' })
      expect(res.status).toBe(200)
    })

    test('accepts "sonnet"', async () => {
      const { put } = createTestApp()
      const res = await put('/api/config/assistant.model', { value: 'sonnet' })
      expect(res.status).toBe(200)
    })

    test('accepts "haiku"', async () => {
      const { put } = createTestApp()
      const res = await put('/api/config/assistant.model', { value: 'haiku' })
      expect(res.status).toBe(200)
    })

    test('rejects invalid model', async () => {
      const { put } = createTestApp()
      const res = await put('/api/config/assistant.model', { value: 'gpt-4' })
      expect(res.status).toBe(400)
      const body = await res.json()
      expect(body.error).toContain('must be one of')
    })
  })

  describe('GET /api/config - observer settings in full config', () => {
    test('includes observer settings in config dump', async () => {
      const { get } = createTestApp()
      const res = await get('/api/config')
      const body = await res.json()

      expect(res.status).toBe(200)
      // These new keys should appear in the full config
      expect('assistant.observerProvider' in body).toBe(true)
      expect('assistant.observerOpencodeModel' in body).toBe(true)
      expect('assistant.provider' in body).toBe(true)
      expect('assistant.model' in body).toBe(true)
      expect('agent.opencodeModel' in body).toBe(true)
      expect('agent.opencodeDefaultAgent' in body).toBe(true)
      expect('agent.opencodePlanAgent' in body).toBe(true)
    })
  })

  describe('DELETE /api/config - reset observer settings', () => {
    test('resets observer provider to default (null)', async () => {
      const { put, request, get } = createTestApp()

      // Set a non-default value
      await put('/api/config/assistant.observerProvider', { value: 'opencode' })

      // Reset it
      const res = await request('/api/config/assistant.observerProvider', { method: 'DELETE' })
      expect(res.status).toBe(200)

      // Should be back to default (null)
      const checkRes = await get('/api/config/assistant.observerProvider')
      const checkBody = await checkRes.json()
      expect(checkBody.value).toBe(null)
    })

    test('resets observer opencode model to default (null)', async () => {
      const { put, request, get } = createTestApp()

      await put('/api/config/assistant.observerOpencodeModel', { value: 'anthropic/claude-sonnet-4-5' })

      const res = await request('/api/config/assistant.observerOpencodeModel', { method: 'DELETE' })
      expect(res.status).toBe(200)

      const checkRes = await get('/api/config/assistant.observerOpencodeModel')
      const checkBody = await checkRes.json()
      expect(checkBody.value).toBe(null)
    })
  })
})
