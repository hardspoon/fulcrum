/**
 * Gmail Backend for Email Channel
 *
 * Wraps the Gmail service to match the polling/sending pattern of EmailChannel.
 * Used when email backend is set to 'gmail-api'.
 */

import { log } from '../../lib/logger'
import {
  pollNewMessages,
  listMessages,
} from '../google/gmail-service'
import { storeEmail } from './email-storage'
import { checkAuthorization } from './email-auth'
import { isAutomatedEmail } from './email-types'
import type { IncomingMessage, ChannelEvents, ConnectionStatus } from './types'
import { db, googleAccounts } from '../../db'
import { eq } from 'drizzle-orm'
import { getSettings } from '../../lib/settings'

export class GmailBackend {
  private connectionId: string
  private googleAccountId: string
  private events: ChannelEvents | null = null
  private pollTimer: ReturnType<typeof setInterval> | null = null
  private isShuttingDown = false
  private lastHistoryId: string | null = null
  private status: ConnectionStatus = 'disconnected'

  constructor(connectionId: string, googleAccountId: string) {
    this.connectionId = connectionId
    this.googleAccountId = googleAccountId
  }

  async initialize(events: ChannelEvents): Promise<void> {
    this.events = events
    this.isShuttingDown = false

    try {
      this.updateStatus('connecting')

      // Verify we can access Gmail
      await listMessages(this.googleAccountId, { maxResults: 1 })

      this.updateStatus('connected')
      this.startPolling()

      log.messaging.info('Gmail backend initialized', {
        connectionId: this.connectionId,
        googleAccountId: this.googleAccountId,
      })
    } catch (err) {
      log.messaging.error('Gmail backend initialization failed', {
        connectionId: this.connectionId,
        error: String(err),
      })
      this.updateStatus('disconnected')
    }
  }

  private startPolling(): void {
    if (this.pollTimer) return

    const settings = getSettings()
    const intervalMs = (settings.channels.email.pollIntervalSeconds || 30) * 1000

    // Initial poll
    this.poll()

    this.pollTimer = setInterval(() => {
      this.poll()
    }, intervalMs)
  }

  private async poll(): Promise<void> {
    if (this.isShuttingDown) return

    try {
      const result = await pollNewMessages(this.googleAccountId, {
        historyId: this.lastHistoryId ?? undefined,
        maxResults: 20,
      })

      this.lastHistoryId = result.latestHistoryId

      // Get account email to filter self-sent messages
      const account = db.select().from(googleAccounts)
        .where(eq(googleAccounts.id, this.googleAccountId))
        .get()
      const selfEmail = account?.email?.toLowerCase() ?? ''

      const settings = getSettings()
      const allowedSenders = settings.channels.email.allowedSenders ?? []

      for (const msg of result.messages) {
        if (!msg.from) continue

        // Extract email from "Name <email>" format
        const fromMatch = msg.from.match(/<([^>]+)>/)
        const fromEmail = (fromMatch ? fromMatch[1] : msg.from).toLowerCase()

        // Skip self-sent
        if (fromEmail === selfEmail) continue

        // Skip automated emails
        const automatedCheck = isAutomatedEmail({
          from: fromEmail,
          subject: msg.subject,
          listUnsubscribe: null,
          precedence: null,
          autoSubmitted: null,
          xAutoResponseSuppress: null,
          xMailer: null,
          contentType: null,
          returnPath: null,
        })
        if (automatedCheck.isAutomated) continue

        // Check authorization
        const authResult = await checkAuthorization(
          this.connectionId,
          {
            from: fromEmail,
            fromName: msg.from.replace(/<[^>]+>/, '').trim() || null,
            to: msg.to,
            cc: msg.cc,
            subject: msg.subject,
            messageId: msg.messageId,
            inReplyTo: msg.inReplyTo,
            references: [],
            date: msg.date ? new Date(msg.date) : null,
            listUnsubscribe: null,
            precedence: null,
            autoSubmitted: null,
            xAutoResponseSuppress: null,
            xMailer: null,
            contentType: null,
          },
          allowedSenders,
          selfEmail
        )

        // Store email
        if (msg.messageId) {
          storeEmail({
            connectionId: this.connectionId,
            messageId: msg.messageId,
            threadId: authResult.threadId,
            inReplyTo: msg.inReplyTo ?? undefined,
            direction: 'incoming',
            fromAddress: fromEmail,
            fromName: msg.from.replace(/<[^>]+>/, '').trim() || undefined,
            toAddresses: msg.to.length > 0 ? msg.to : undefined,
            ccAddresses: msg.cc.length > 0 ? msg.cc : undefined,
            subject: msg.subject ?? undefined,
            textContent: msg.body ?? undefined,
          })
        }

        // Emit incoming message
        const incomingMessage: IncomingMessage = {
          channelType: 'email',
          connectionId: this.connectionId,
          senderId: fromEmail,
          senderName: msg.from.replace(/<[^>]+>/, '').trim() || undefined,
          content: msg.body ?? '',
          timestamp: msg.date ? new Date(msg.date) : new Date(),
          metadata: {
            messageId: msg.messageId,
            inReplyTo: msg.inReplyTo,
            subject: msg.subject,
            threadId: authResult.threadId,
            observeOnly: !authResult.authorized,
          },
        }

        try {
          await this.events?.onMessage(incomingMessage)
        } catch (err) {
          log.messaging.error('Error processing Gmail message', {
            connectionId: this.connectionId,
            error: String(err),
          })
        }
      }
    } catch (err) {
      log.messaging.error('Gmail poll error', {
        connectionId: this.connectionId,
        error: String(err),
      })
    }
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  async sendMessage(recipientId: string, content: string, metadata?: Record<string, unknown>): Promise<boolean> {
    log.messaging.warn('Email sending disabled — use Gmail drafts instead', {
      connectionId: this.connectionId,
    })
    return false
  }

  async shutdown(): Promise<void> {
    this.isShuttingDown = true
    if (this.pollTimer) {
      clearInterval(this.pollTimer)
      this.pollTimer = null
    }
    this.updateStatus('disconnected')
  }

  getStatus(): ConnectionStatus {
    return this.status
  }

  private updateStatus(status: ConnectionStatus): void {
    this.status = status
    this.events?.onConnectionChange(status)
  }
}
