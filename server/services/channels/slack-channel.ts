/**
 * Slack channel implementation using @slack/bolt library.
 * Uses Socket Mode for real-time messaging without needing a public URL.
 */

import { App, LogLevel, type SlashCommand, type RespondFn } from '@slack/bolt'
import type { KnownBlock, ChatPostMessageArguments } from '@slack/web-api'
import { eq } from 'drizzle-orm'
import { readFileSync } from 'fs'
import { basename } from 'path'
import { db, messagingConnections } from '../../db'
import { log } from '../../lib/logger'
import { getSettings } from '../../lib/settings'
import type { AttachmentData } from '../../../shared/types'
import type {
  MessagingChannel,
  ChannelEvents,
  ConnectionStatus,
  IncomingMessage,
} from './types'

/** Shape of a Slack file object attached to a message */
interface SlackFile {
  id: string
  name: string
  mimetype: string
  size: number
  url_private_download?: string
}

/** MIME types we support downloading from Slack */
const SUPPORTED_MIME_TYPES = new Set([
  'image/png',
  'image/jpeg',
  'image/gif',
  'image/webp',
  'application/pdf',
  'text/plain',
  'text/csv',
  'text/markdown',
])

/** Max file size we'll download (10 MB) */
const MAX_FILE_SIZE = 10 * 1024 * 1024

export class SlackChannel implements MessagingChannel {
  readonly type = 'slack' as const
  readonly connectionId: string

  private app: App | null = null
  private events: ChannelEvents | null = null
  private status: ConnectionStatus = 'disconnected'
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null
  private healthCheckTimer: ReturnType<typeof setInterval> | null = null
  private isShuttingDown = false
  private botToken: string | null = null
  private appToken: string | null = null

  /** How often to verify the connection is alive (ms) */
  private static HEALTH_CHECK_INTERVAL = 5 * 60 * 1000 // 5 minutes

  constructor(connectionId: string) {
    this.connectionId = connectionId
  }

  async initialize(events: ChannelEvents): Promise<void> {
    this.events = events
    this.isShuttingDown = false

    // Load credentials from settings
    const settings = getSettings()
    const slackConfig = settings.channels.slack

    if (!slackConfig.botToken || !slackConfig.appToken) {
      log.messaging.warn('Slack channel missing credentials', {
        connectionId: this.connectionId,
      })
      this.updateStatus('disconnected')
      return
    }

    this.botToken = slackConfig.botToken
    this.appToken = slackConfig.appToken

    await this.connect()
  }

  private async connect(): Promise<void> {
    if (this.isShuttingDown || !this.botToken || !this.appToken) return

    try {
      this.updateStatus('connecting')

      // Create Slack app with Socket Mode
      this.app = new App({
        token: this.botToken,
        appToken: this.appToken,
        socketMode: true,
        logLevel: LogLevel.WARN,
      })

      // Handle slash commands (must register before starting)
      this.app.command(/.*/, async ({ ack, command, respond }) => {
        await ack() // Must acknowledge immediately
        await this.handleSlashCommand(command, respond)
      })

      // Handle DM messages only
      // Note: app.message() handles all message events including DMs
      // We filter to only process direct messages (im channel type)
      this.app.message(async ({ message }) => {
        // Only process DMs, ignore channel/group messages
        if ((message as Record<string, unknown>).channel_type === 'im') {
          await this.handleMessage(message)
        }
      })

      // Start the app
      await this.app.start()

      // Listen for Socket Mode connection state changes
      this.setupSocketModeListeners()

      // Get bot info
      const authTest = await this.app.client.auth.test()

      log.messaging.info('Slack bot connected', {
        connectionId: this.connectionId,
        botId: authTest.bot_id,
        userId: authTest.user_id,
      })
      this.updateStatus('connected')

      // Start periodic health checks
      this.startHealthCheck()

      // Store display name (bot name or workspace)
      const displayName = (authTest.user as string) || 'Slack Bot'
      db.update(messagingConnections)
        .set({
          displayName,
          updatedAt: new Date().toISOString(),
        })
        .where(eq(messagingConnections.id, this.connectionId))
        .run()
      this.events?.onDisplayNameChange?.(displayName)
    } catch (err) {
      log.messaging.error('Slack connect error', {
        connectionId: this.connectionId,
        error: String(err),
      })
      this.updateStatus('disconnected')
      this.scheduleReconnect()
    }
  }

  /**
   * Listen for Socket Mode client state changes so we detect silent disconnects.
   * The SocketModeClient (on the receiver) emits: connected, disconnected, reconnecting, etc.
   */
  private setupSocketModeListeners(): void {
    // Access the SocketModeClient from the Bolt receiver
    const receiver = (this.app as unknown as { receiver: { client: import('eventemitter3').EventEmitter } })?.receiver
    const socketClient = receiver?.client
    if (!socketClient) {
      log.messaging.warn('Could not access Socket Mode client for health monitoring', {
        connectionId: this.connectionId,
      })
      return
    }

    socketClient.on('disconnected', () => {
      if (this.isShuttingDown) return
      log.messaging.warn('Slack Socket Mode disconnected', {
        connectionId: this.connectionId,
      })
      this.updateStatus('disconnected')
    })

    socketClient.on('reconnecting', () => {
      if (this.isShuttingDown) return
      log.messaging.info('Slack Socket Mode reconnecting', {
        connectionId: this.connectionId,
      })
      this.updateStatus('connecting')
    })

    socketClient.on('connected', () => {
      if (this.isShuttingDown) return
      log.messaging.info('Slack Socket Mode reconnected', {
        connectionId: this.connectionId,
      })
      this.updateStatus('connected')
    })

    log.messaging.debug('Socket Mode event listeners attached', {
      connectionId: this.connectionId,
    })
  }

  /**
   * Periodic health check: call auth.test to verify the connection is truly alive.
   * Catches cases where the socket silently dies without emitting disconnect events.
   */
  private startHealthCheck(): void {
    this.stopHealthCheck()
    this.healthCheckTimer = setInterval(async () => {
      if (this.isShuttingDown || !this.app || this.status !== 'connected') return

      try {
        await this.app.client.auth.test()
      } catch (err) {
        log.messaging.warn('Slack health check failed, triggering reconnect', {
          connectionId: this.connectionId,
          error: String(err),
        })
        this.updateStatus('disconnected')

        // Tear down and reconnect
        try {
          await this.app?.stop()
        } catch {
          // ignore stop errors
        }
        this.app = null
        this.scheduleReconnect()
      }
    }, SlackChannel.HEALTH_CHECK_INTERVAL)
  }

  private stopHealthCheck(): void {
    if (this.healthCheckTimer) {
      clearInterval(this.healthCheckTimer)
      this.healthCheckTimer = null
    }
  }

  private async handleMessage(message: Record<string, unknown>): Promise<void> {
    // Ignore bot messages (including self)
    if (message.bot_id || message.subtype === 'bot_message') return

    const content = (message.text as string | undefined) || ''
    const files = message.files as SlackFile[] | undefined

    // Need either text or files
    if (!content && (!files || files.length === 0)) return

    const userId = message.user as string
    if (!userId) return

    // Get user info for display name
    let senderName: string | undefined
    try {
      if (this.app) {
        const userInfo = await this.app.client.users.info({ user: userId })
        senderName = userInfo.user?.real_name || userInfo.user?.name
      }
    } catch {
      // Ignore errors getting user info
    }

    // Download any attached files
    let attachments: AttachmentData[] | undefined
    if (files && files.length > 0) {
      const downloaded = await this.downloadSlackFiles(files)
      if (downloaded.length > 0) {
        attachments = downloaded
      }
    }

    const incomingMessage: IncomingMessage = {
      channelType: 'slack',
      connectionId: this.connectionId,
      senderId: userId,
      senderName,
      content,
      attachments,
      timestamp: new Date(parseFloat(message.ts as string) * 1000),
      metadata: files?.length ? {
        files: files.map((f) => ({ name: f.name, type: f.mimetype, size: f.size })),
      } : undefined,
    }

    log.messaging.info('Slack message received', {
      connectionId: this.connectionId,
      from: userId,
      contentLength: content.length,
      fileCount: files?.length ?? 0,
      attachmentCount: attachments?.length ?? 0,
    })

    try {
      await this.events?.onMessage(incomingMessage)
    } catch (err) {
      log.messaging.error('Error processing Slack message', {
        connectionId: this.connectionId,
        error: String(err),
      })
    }
  }

  /**
   * Download multiple Slack files, skipping unsupported/oversized ones.
   */
  private async downloadSlackFiles(files: SlackFile[]): Promise<AttachmentData[]> {
    const results: AttachmentData[] = []

    for (const file of files) {
      try {
        const attachment = await this.downloadSlackFile(file)
        if (attachment) {
          results.push(attachment)
        }
      } catch (err) {
        log.messaging.warn('Failed to download Slack file', {
          connectionId: this.connectionId,
          fileName: file.name,
          error: String(err),
        })
      }
    }

    return results
  }

  /**
   * Download a single Slack file and return it as an AttachmentData.
   * Returns null for unsupported/oversized files.
   */
  private async downloadSlackFile(file: SlackFile): Promise<AttachmentData | null> {
    if (!file.url_private_download) {
      log.messaging.warn('Slack file has no download URL', {
        fileName: file.name,
        fileId: file.id,
      })
      return null
    }

    if (file.size > MAX_FILE_SIZE) {
      log.messaging.warn('Slack file too large, skipping', {
        fileName: file.name,
        size: file.size,
        maxSize: MAX_FILE_SIZE,
      })
      return null
    }

    if (!SUPPORTED_MIME_TYPES.has(file.mimetype)) {
      log.messaging.warn('Unsupported Slack file type, skipping', {
        fileName: file.name,
        mimeType: file.mimetype,
      })
      return null
    }

    const response = await fetch(file.url_private_download, {
      headers: {
        Authorization: `Bearer ${this.botToken}`,
      },
    })

    if (!response.ok) {
      log.messaging.warn('Failed to download Slack file', {
        fileName: file.name,
        status: response.status,
      })
      return null
    }

    const isText = file.mimetype.startsWith('text/')
    const type: AttachmentData['type'] = file.mimetype.startsWith('image/')
      ? 'image'
      : isText
        ? 'text'
        : 'document'

    if (isText) {
      const text = await response.text()
      return {
        mediaType: file.mimetype,
        data: text,
        filename: file.name,
        type,
      }
    }

    const buffer = Buffer.from(await response.arrayBuffer())
    return {
      mediaType: file.mimetype,
      data: buffer.toString('base64'),
      filename: file.name,
      type,
    }
  }

  /**
   * Handle slash command interactions.
   * Commands are routed to the message handler and acknowledged with an ephemeral response.
   */
  private async handleSlashCommand(
    command: SlashCommand,
    respond: RespondFn
  ): Promise<void> {
    log.messaging.info('Slack slash command received', {
      connectionId: this.connectionId,
      command: command.command,
      userId: command.user_id,
      userName: command.user_name,
    })

    // Convert slash command to an IncomingMessage for the standard command handler
    const incomingMessage: IncomingMessage = {
      channelType: 'slack',
      connectionId: this.connectionId,
      senderId: command.user_id,
      senderName: command.user_name,
      content: command.command, // e.g., "/reset"
      timestamp: new Date(),
      metadata: {
        isSlashCommand: true,
      },
    }

    try {
      await this.events?.onMessage(incomingMessage)

      // Ephemeral acknowledgment to the user
      await respond({ text: '✓ Command received', response_type: 'ephemeral' })
    } catch (err) {
      log.messaging.error('Error processing Slack slash command', {
        connectionId: this.connectionId,
        command: command.command,
        error: String(err),
      })
      await respond({
        text: 'Sorry, something went wrong processing your command.',
        response_type: 'ephemeral',
      })
    }
  }

  async shutdown(): Promise<void> {
    this.isShuttingDown = true
    this.stopHealthCheck()

    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer)
      this.reconnectTimer = null
    }

    if (this.app) {
      await this.app.stop()
      this.app = null
    }

    this.updateStatus('disconnected')
    log.messaging.info('Slack channel shutdown', {
      connectionId: this.connectionId,
    })
  }

  async sendMessage(
    recipientId: string,
    content: string,
    metadata?: Record<string, unknown>
  ): Promise<boolean> {
    if (!this.app || this.status !== 'connected') {
      log.messaging.warn('Cannot send Slack message - not connected', {
        connectionId: this.connectionId,
        status: this.status,
      })
      return false
    }

    try {
      // Open or get existing DM channel with user
      const conversation = await this.app.client.conversations.open({
        users: recipientId,
      })

      const channelId = conversation.channel?.id
      if (!channelId) {
        throw new Error('Failed to open DM channel')
      }

      // Upload file if provided
      if (metadata?.filePath) {
        const filePath = metadata.filePath as string
        try {
          const fileData = readFileSync(filePath)
          const filename = basename(filePath)
          await this.app.client.files.uploadV2({
            channel_id: channelId,
            file: fileData,
            filename,
            initial_comment: content || undefined,
          })
          log.messaging.info('Slack file uploaded', {
            connectionId: this.connectionId,
            to: recipientId,
            filename,
          })
          return true
        } catch (fileErr) {
          log.messaging.error('Failed to upload Slack file', {
            connectionId: this.connectionId,
            filePath,
            error: String(fileErr),
          })
          // Fall through to send text-only message
        }
      }

      // Slack has a ~40000 character limit but best practice is to keep it shorter
      // We'll use 4000 as a practical limit
      if (content.length <= 4000) {
        const messageOptions: ChatPostMessageArguments = {
          channel: channelId,
          text: content, // Fallback for notifications
        }

        // Use blocks if provided, otherwise use mrkdwn text
        if (metadata?.blocks) {
          messageOptions.blocks = metadata.blocks as KnownBlock[]
        } else {
          messageOptions.mrkdwn = true
        }

        await this.app.client.chat.postMessage(messageOptions)
      } else {
        // Split message if too long (blocks not supported for split messages)
        const parts = this.splitMessage(content, 4000)
        for (const part of parts) {
          await this.app.client.chat.postMessage({
            channel: channelId,
            text: part,
            mrkdwn: true,
          })
          // Small delay between messages
          await new Promise((resolve) => setTimeout(resolve, 100))
        }
      }

      log.messaging.info('Slack message sent', {
        connectionId: this.connectionId,
        to: recipientId,
        contentLength: content.length,
        hasBlocks: !!metadata?.blocks,
      })

      return true
    } catch (err) {
      log.messaging.error('Failed to send Slack message', {
        connectionId: this.connectionId,
        to: recipientId,
        error: String(err),
      })
      return false
    }
  }

  private splitMessage(content: string, maxLength: number): string[] {
    const parts: string[] = []
    let remaining = content

    while (remaining.length > 0) {
      if (remaining.length <= maxLength) {
        parts.push(remaining)
        break
      }

      // Try to find a good break point
      let breakPoint = remaining.lastIndexOf('\n\n', maxLength)
      if (breakPoint === -1 || breakPoint < maxLength / 2) {
        breakPoint = remaining.lastIndexOf('\n', maxLength)
      }
      if (breakPoint === -1 || breakPoint < maxLength / 2) {
        breakPoint = remaining.lastIndexOf(' ', maxLength)
      }
      if (breakPoint === -1 || breakPoint < maxLength / 2) {
        breakPoint = maxLength
      }

      parts.push(remaining.slice(0, breakPoint))
      remaining = remaining.slice(breakPoint).trimStart()
    }

    return parts
  }

  getStatus(): ConnectionStatus {
    return this.status
  }

  // Slack uses token-based auth, no QR code needed
  // Auth is handled via setTokens method before initialize

  async logout(): Promise<void> {
    this.stopHealthCheck()

    if (this.app) {
      await this.app.stop()
      this.app = null
    }

    this.botToken = null
    this.appToken = null

    // Clear runtime state in database (credentials are in settings.json)
    db.update(messagingConnections)
      .set({
        displayName: null,
        status: 'disconnected',
        updatedAt: new Date().toISOString(),
      })
      .where(eq(messagingConnections.id, this.connectionId))
      .run()

    this.updateStatus('disconnected')
  }

  private updateStatus(status: ConnectionStatus): void {
    this.status = status

    // Update database
    db.update(messagingConnections)
      .set({
        status,
        updatedAt: new Date().toISOString(),
      })
      .where(eq(messagingConnections.id, this.connectionId))
      .run()

    // Notify listeners
    this.events?.onConnectionChange(status)
  }

  private scheduleReconnect(): void {
    if (this.reconnectTimer || this.isShuttingDown) return

    log.messaging.debug('Scheduling Slack reconnect', {
      connectionId: this.connectionId,
      delayMs: 5000,
    })

    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null
      this.connect()
    }, 5000)
  }
}
