// Tests for message handler - observe-only routing, command parsing, auto-send responses
import { describe, test, expect, beforeEach, afterEach } from 'bun:test'
import { setupTestEnv, type TestEnv } from '../../__tests__/utils/env'
import { nanoid } from 'nanoid'
import { db, messagingConnections } from '../../db'
import { activeChannels } from './channel-manager'
import { handleIncomingMessage, _deps } from './message-handler'

// Track mock calls
let streamMessageCalls: Array<{ sessionId: string; message: string; options?: Record<string, unknown> }> = []
let opencodeObserverCalls: Array<{ sessionId: string; message: string; options?: Record<string, unknown> }> = []

// Save original deps
const originalStreamMessage = _deps.streamMessage
const originalStreamOpencodeObserverMessage = _deps.streamOpencodeObserverMessage

describe('Message Handler', () => {
  let testEnv: TestEnv
  let connectionId: string

  beforeEach(() => {
    testEnv = setupTestEnv()
    streamMessageCalls = []
    opencodeObserverCalls = []
    activeChannels.clear()

    // Replace deps with mocks (avoids mock.module which is unreliable across test files)
    _deps.streamMessage = async function* (sessionId: string, message: string, options?: Record<string, unknown>) {
      streamMessageCalls.push({ sessionId, message, options })
      yield { type: 'content:delta', data: { text: 'Mock response' } }
      yield { type: 'message:complete', data: { content: 'Mock response' } }
      yield { type: 'done', data: {} }
    } as typeof _deps.streamMessage

    _deps.streamOpencodeObserverMessage = async function* (sessionId: string, message: string, options?: Record<string, unknown>) {
      opencodeObserverCalls.push({ sessionId, message, options })
      yield { type: 'done', data: {} }
    } as typeof _deps.streamOpencodeObserverMessage

    // Create a real messaging connection in the DB for session-mapper
    connectionId = nanoid()
    db.insert(messagingConnections)
      .values({
        id: connectionId,
        channelType: 'whatsapp',
        enabled: true,
        status: 'connected',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      })
      .run()

    // Add a mock channel instance so responses can be "sent"
    activeChannels.set(connectionId, {
      connectionId,
      type: 'whatsapp',
      initialize: async () => {},
      shutdown: async () => {},
      sendMessage: async () => true,
      getStatus: () => 'connected' as const,
      logout: async () => {},
    })
  })

  afterEach(() => {
    activeChannels.clear()
    // Restore original deps
    _deps.streamMessage = originalStreamMessage
    _deps.streamOpencodeObserverMessage = originalStreamOpencodeObserverMessage
    testEnv.cleanup()
  })

  describe('Observe-only messages', () => {
    test('routes observe-only message to observer processing', async () => {
      await handleIncomingMessage({
        connectionId,
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

    test('observe-only message does not send a response', async () => {
      const sendCalls: string[] = []
      activeChannels.set(connectionId, {
        connectionId,
        type: 'whatsapp',
        initialize: async () => {},
        shutdown: async () => {},
        sendMessage: async (_to: string, content: string) => { sendCalls.push(content); return true },
        getStatus: () => 'connected' as const,
        logout: async () => {},
      })

      await handleIncomingMessage({
        connectionId,
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
        connectionId,
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

    test('auto-sends assistant text response to channel', async () => {
      const sendCalls: Array<{ to: string; content: string; metadata?: Record<string, unknown> }> = []
      activeChannels.set(connectionId, {
        connectionId,
        type: 'whatsapp',
        initialize: async () => {},
        shutdown: async () => {},
        sendMessage: async (to: string, content: string, metadata?: Record<string, unknown>) => {
          sendCalls.push({ to, content, metadata })
          return true
        },
        getStatus: () => 'connected' as const,
        logout: async () => {},
      })

      await handleIncomingMessage({
        connectionId,
        channelType: 'whatsapp',
        senderId: 'user123',
        senderName: 'John',
        content: 'Hello!',
        metadata: {},
      })

      // The assistant's text response should be auto-sent
      expect(sendCalls).toHaveLength(1)
      expect(sendCalls[0].content).toBe('Mock response')
      expect(sendCalls[0].to).toBe('user123')
    })

    test('does not send response when assistant produces no text', async () => {
      // Override mock to produce no text
      _deps.streamMessage = async function* (sessionId: string, message: string, options?: Record<string, unknown>) {
        streamMessageCalls.push({ sessionId, message, options })
        yield { type: 'done', data: {} }
      } as typeof _deps.streamMessage

      const sendCalls: string[] = []
      activeChannels.set(connectionId, {
        connectionId,
        type: 'whatsapp',
        initialize: async () => {},
        shutdown: async () => {},
        sendMessage: async (_to: string, content: string) => { sendCalls.push(content); return true },
        getStatus: () => 'connected' as const,
        logout: async () => {},
      })

      await handleIncomingMessage({
        connectionId,
        channelType: 'whatsapp',
        senderId: 'user123',
        content: 'spam newsletter',
        metadata: {},
      })

      // No text produced = no response sent (spam/ignored)
      expect(sendCalls).toHaveLength(0)
    })
  })

  describe('Slack structured output', () => {
    let slackConnectionId: string

    beforeEach(() => {
      slackConnectionId = nanoid()
      db.insert(messagingConnections)
        .values({
          id: slackConnectionId,
          channelType: 'slack',
          enabled: true,
          status: 'connected',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        })
        .run()
    })

    test('passes outputFormat for Slack messages', async () => {
      activeChannels.set(slackConnectionId, {
        connectionId: slackConnectionId,
        type: 'slack',
        initialize: async () => {},
        shutdown: async () => {},
        sendMessage: async () => true,
        getStatus: () => 'connected' as const,
        logout: async () => {},
      })

      await handleIncomingMessage({
        connectionId: slackConnectionId,
        channelType: 'slack',
        senderId: 'U12345',
        senderName: 'Alice',
        content: 'What tasks are open?',
        metadata: {},
      })

      expect(streamMessageCalls).toHaveLength(1)
      const opts = streamMessageCalls[0].options as Record<string, unknown>
      expect(opts.outputFormat).toBeDefined()
      const outputFormat = opts.outputFormat as { type: string; schema: Record<string, unknown> }
      expect(outputFormat.type).toBe('json_schema')
      expect(outputFormat.schema).toHaveProperty('properties')
    })

    test('sends structured output with blocks for Slack', async () => {
      const sendCalls: Array<{ to: string; content: string; metadata?: Record<string, unknown> }> = []

      // Mock stream that yields structured output
      _deps.streamMessage = async function* (sessionId: string, message: string, options?: Record<string, unknown>) {
        streamMessageCalls.push({ sessionId, message, options })
        yield { type: 'structured_output', data: {
          body: 'Here are your open tasks',
          blocks: [
            { type: 'section', text: { type: 'mrkdwn', text: '*Open Tasks:*\n- Task 1\n- Task 2' } },
          ],
        }}
        yield { type: 'done', data: {} }
      } as typeof _deps.streamMessage

      activeChannels.set(slackConnectionId, {
        connectionId: slackConnectionId,
        type: 'slack',
        initialize: async () => {},
        shutdown: async () => {},
        sendMessage: async (to: string, content: string, metadata?: Record<string, unknown>) => {
          sendCalls.push({ to, content, metadata })
          return true
        },
        getStatus: () => 'connected' as const,
        logout: async () => {},
      })

      await handleIncomingMessage({
        connectionId: slackConnectionId,
        channelType: 'slack',
        senderId: 'U12345',
        senderName: 'Alice',
        content: 'What tasks are open?',
        metadata: {},
      })

      expect(sendCalls).toHaveLength(1)
      expect(sendCalls[0].content).toBe('Here are your open tasks')
      expect(sendCalls[0].metadata).toBeDefined()
      expect(sendCalls[0].metadata!.blocks).toBeDefined()
      const blocks = sendCalls[0].metadata!.blocks as unknown[]
      expect(blocks).toHaveLength(1)
    })

    test('falls back to text response if no structured output for Slack', async () => {
      const sendCalls: Array<{ to: string; content: string }> = []

      // Mock stream that yields only text (structured output failed)
      _deps.streamMessage = async function* (sessionId: string, message: string, options?: Record<string, unknown>) {
        streamMessageCalls.push({ sessionId, message, options })
        yield { type: 'message:complete', data: { content: 'Fallback text response' } }
        yield { type: 'done', data: {} }
      } as typeof _deps.streamMessage

      activeChannels.set(slackConnectionId, {
        connectionId: slackConnectionId,
        type: 'slack',
        initialize: async () => {},
        shutdown: async () => {},
        sendMessage: async (to: string, content: string) => {
          sendCalls.push({ to, content })
          return true
        },
        getStatus: () => 'connected' as const,
        logout: async () => {},
      })

      await handleIncomingMessage({
        connectionId: slackConnectionId,
        channelType: 'slack',
        senderId: 'U12345',
        senderName: 'Alice',
        content: 'Hello',
        metadata: {},
      })

      // Should fall back to text when no structured output
      expect(sendCalls).toHaveLength(1)
      expect(sendCalls[0].content).toBe('Fallback text response')
    })
  })

  describe('Command handling', () => {
    test('recognizes /reset command', async () => {
      const sendCalls: string[] = []
      activeChannels.set(connectionId, {
        connectionId,
        type: 'whatsapp',
        initialize: async () => {},
        shutdown: async () => {},
        sendMessage: async (_to: string, content: string) => { sendCalls.push(content); return true },
        getStatus: () => 'connected' as const,
        logout: async () => {},
      })

      await handleIncomingMessage({
        connectionId,
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
      activeChannels.set(connectionId, {
        connectionId,
        type: 'whatsapp',
        initialize: async () => {},
        shutdown: async () => {},
        sendMessage: async (_to: string, content: string) => { sendCalls.push(content); return true },
        getStatus: () => 'connected' as const,
        logout: async () => {},
      })

      await handleIncomingMessage({
        connectionId,
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
      activeChannels.set(connectionId, {
        connectionId,
        type: 'whatsapp',
        initialize: async () => {},
        shutdown: async () => {},
        sendMessage: async (_to: string, content: string) => { sendCalls.push(content); return true },
        getStatus: () => 'connected' as const,
        logout: async () => {},
      })

      await handleIncomingMessage({
        connectionId,
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
      activeChannels.set(connectionId, {
        connectionId,
        type: 'whatsapp',
        initialize: async () => {},
        shutdown: async () => {},
        sendMessage: async (_to: string, content: string) => { sendCalls.push(content); return true },
        getStatus: () => 'connected' as const,
        logout: async () => {},
      })

      await handleIncomingMessage({
        connectionId,
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
      activeChannels.set(connectionId, {
        connectionId,
        type: 'whatsapp',
        initialize: async () => {},
        shutdown: async () => {},
        sendMessage: async (_to: string, content: string) => { sendCalls.push(content); return true },
        getStatus: () => 'connected' as const,
        logout: async () => {},
      })

      await handleIncomingMessage({
        connectionId,
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
