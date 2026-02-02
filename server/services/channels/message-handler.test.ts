// Tests for message handler - observe-only routing, command parsing, security tier selection
import { describe, test, expect, beforeEach, afterEach, mock } from 'bun:test'
import { setupTestEnv, type TestEnv } from '../../__tests__/utils/env'

// Mock the assistant service and opencode channel service before importing
mock.module('../assistant-service', () => ({
  streamMessage: async function* (sessionId: string, message: string, options?: Record<string, unknown>) {
    // Track calls for assertions
    streamMessageCalls.push({ sessionId, message, options })
    yield { type: 'content:delta', data: { text: 'Mock response' } }
    yield { type: 'done', data: {} }
  },
}))

mock.module('../opencode-channel-service', () => ({
  streamOpencodeObserverMessage: async function* (sessionId: string, message: string, options?: Record<string, unknown>) {
    opencodeObserverCalls.push({ sessionId, message, options })
    yield { type: 'done', data: {} }
  },
}))

// Mock the channel manager
const mockActiveChannels = new Map()

mock.module('./channel-manager', () => ({
  activeChannels: mockActiveChannels,
  setMessageHandler: () => {},
}))

// Mock session mapper
mock.module('./session-mapper', () => ({
  getOrCreateSession: (...args: unknown[]) => ({
    session: { id: `session-${args[0]}-${args[1]}`, messageCount: 0 },
    mapping: { createdAt: new Date().toISOString(), lastMessageAt: new Date().toISOString() },
  }),
  resetSession: () => {},
}))

// Mock system prompts
mock.module('./system-prompts', () => ({
  getMessagingSystemPrompt: () => 'mock system prompt',
  getObserveOnlySystemPrompt: () => 'mock observe-only prompt',
}))

// Track mock calls
let streamMessageCalls: Array<{ sessionId: string; message: string; options?: Record<string, unknown> }> = []
let opencodeObserverCalls: Array<{ sessionId: string; message: string; options?: Record<string, unknown> }> = []

// Import after mocks are set up
import { handleIncomingMessage } from './message-handler'

describe('Message Handler', () => {
  let testEnv: TestEnv

  beforeEach(() => {
    testEnv = setupTestEnv()
    streamMessageCalls = []
    opencodeObserverCalls = []
    mockActiveChannels.clear()

    // Add a mock channel so responses can be "sent"
    mockActiveChannels.set('test-conn', {
      sendMessage: async () => {},
    })
  })

  afterEach(() => {
    testEnv.cleanup()
  })

  describe('Observe-only messages', () => {
    test('routes observe-only message to observer processing', async () => {
      await handleIncomingMessage({
        connectionId: 'test-conn',
        channelType: 'whatsapp',
        senderId: 'user123',
        senderName: 'John',
        content: 'Meeting at 3pm tomorrow',
        metadata: { observeOnly: true },
      })

      // Should have called Claude observer (default provider), not regular streamMessage
      // The observe-only path uses assistantService.streamMessage with securityTier: 'observer'
      expect(streamMessageCalls.length).toBe(1)
      expect(streamMessageCalls[0].options).toBeDefined()
      expect((streamMessageCalls[0].options as Record<string, unknown>).securityTier).toBe('observer')
    })

    test('observe-only message does not trigger normal chat flow', async () => {
      const sendCalls: string[] = []
      mockActiveChannels.set('test-conn', {
        sendMessage: async (_to: string, content: string) => sendCalls.push(content),
      })

      await handleIncomingMessage({
        connectionId: 'test-conn',
        channelType: 'whatsapp',
        senderId: 'user123',
        content: 'Just chatting',
        metadata: { observeOnly: true },
      })

      // No response should be sent back for observe-only
      expect(sendCalls).toHaveLength(0)
    })
  })

  describe('Regular messages', () => {
    test('routes regular message to assistant', async () => {
      await handleIncomingMessage({
        connectionId: 'test-conn',
        channelType: 'whatsapp',
        senderId: 'user123',
        senderName: 'John',
        content: 'Hello, how are you?',
        metadata: {},
      })

      // Should call assistantService.streamMessage (trusted by default)
      expect(streamMessageCalls.length).toBe(1)
      // Regular messages should NOT have securityTier: 'observer'
      const opts = streamMessageCalls[0].options as Record<string, unknown> | undefined
      expect(opts?.securityTier).toBeUndefined()
    })
  })

  describe('Command handling', () => {
    test('recognizes /reset command', async () => {
      const sendCalls: string[] = []
      mockActiveChannels.set('test-conn', {
        sendMessage: async (_to: string, content: string) => sendCalls.push(content),
      })

      await handleIncomingMessage({
        connectionId: 'test-conn',
        channelType: 'whatsapp',
        senderId: 'user123',
        content: '/reset',
        metadata: {},
      })

      // Should send a reset confirmation, not go to AI
      expect(streamMessageCalls).toHaveLength(0)
      expect(sendCalls.length).toBe(1)
      expect(sendCalls[0]).toContain('reset')
    })

    test('recognizes /help command', async () => {
      const sendCalls: string[] = []
      mockActiveChannels.set('test-conn', {
        sendMessage: async (_to: string, content: string) => sendCalls.push(content),
      })

      await handleIncomingMessage({
        connectionId: 'test-conn',
        channelType: 'whatsapp',
        senderId: 'user123',
        content: '/help',
        metadata: {},
      })

      expect(streamMessageCalls).toHaveLength(0)
      expect(sendCalls.length).toBe(1)
      expect(sendCalls[0]).toContain('help')
    })

    test('recognizes /status command', async () => {
      const sendCalls: string[] = []
      mockActiveChannels.set('test-conn', {
        sendMessage: async (_to: string, content: string) => sendCalls.push(content),
      })

      await handleIncomingMessage({
        connectionId: 'test-conn',
        channelType: 'whatsapp',
        senderId: 'user123',
        content: '/status',
        metadata: {},
      })

      expect(streamMessageCalls).toHaveLength(0)
      expect(sendCalls.length).toBe(1)
      expect(sendCalls[0]).toContain('Session')
    })

    test('commands are case-insensitive', async () => {
      const sendCalls: string[] = []
      mockActiveChannels.set('test-conn', {
        sendMessage: async (_to: string, content: string) => sendCalls.push(content),
      })

      await handleIncomingMessage({
        connectionId: 'test-conn',
        channelType: 'whatsapp',
        senderId: 'user123',
        content: '/RESET',
        metadata: {},
      })

      expect(streamMessageCalls).toHaveLength(0)
      expect(sendCalls.length).toBe(1)
    })

    test('observe-only messages skip commands', async () => {
      const sendCalls: string[] = []
      mockActiveChannels.set('test-conn', {
        sendMessage: async (_to: string, content: string) => sendCalls.push(content),
      })

      await handleIncomingMessage({
        connectionId: 'test-conn',
        channelType: 'whatsapp',
        senderId: 'user123',
        content: '/reset',
        metadata: { observeOnly: true },
      })

      // Observe-only should not process commands
      expect(sendCalls).toHaveLength(0)
    })
  })
})
