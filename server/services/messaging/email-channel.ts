/**
 * Email channel implementation using nodemailer (SMTP) and imapflow (IMAP).
 * Handles sending via SMTP and receiving via IMAP polling.
 */

import { createTransport, type Transporter } from 'nodemailer'
import { ImapFlow } from 'imapflow'
import { eq } from 'drizzle-orm'
import { db, messagingConnections } from '../../db'
import { log } from '../../lib/logger'
import type {
  MessagingChannel,
  ChannelEvents,
  ConnectionStatus,
  IncomingMessage,
  EmailAuthState,
} from './types'

// Email signature patterns to strip from incoming emails
const SIGNATURE_PATTERNS = [
  /^--\s*$/m, // Standard signature delimiter
  /^_{3,}$/m, // Line of underscores
  /^Sent from my (iPhone|iPad|Android|Galaxy|Pixel)/im,
  /^Get Outlook for/im,
  /^Sent via /im,
]

// Quoted reply patterns to strip
const QUOTED_REPLY_PATTERNS = [
  /^On .+, .+ wrote:$/m, // "On Jan 1, 2024, John wrote:"
  /^>+\s?.*/gm, // Lines starting with >
  /^From: .+$/m, // "From: sender@example.com"
  /^Sent: .+$/m, // "Sent: January 1, 2024"
  /^To: .+$/m, // "To: recipient@example.com"
  /^Subject: .+$/m, // "Subject: Re: ..."
]

export class EmailChannel implements MessagingChannel {
  readonly type = 'email' as const
  readonly connectionId: string

  private transporter: Transporter | null = null
  private imapClient: ImapFlow | null = null
  private events: ChannelEvents | null = null
  private status: ConnectionStatus = 'disconnected'
  private pollTimer: ReturnType<typeof setInterval> | null = null
  private isShuttingDown = false
  private credentials: EmailAuthState | null = null
  private lastSeenUid: number = 0

  constructor(connectionId: string, credentials?: EmailAuthState) {
    this.connectionId = connectionId
    this.credentials = credentials ?? null
  }

  async initialize(events: ChannelEvents): Promise<void> {
    this.events = events
    this.isShuttingDown = false

    if (!this.credentials) {
      // Load credentials from database
      const conn = db
        .select()
        .from(messagingConnections)
        .where(eq(messagingConnections.id, this.connectionId))
        .get()

      if (!conn?.authState) {
        this.updateStatus('credentials_required')
        return
      }

      this.credentials = conn.authState as EmailAuthState
    }

    await this.connect()
  }

  private async connect(): Promise<void> {
    if (this.isShuttingDown || !this.credentials) return

    try {
      this.updateStatus('connecting')

      // Setup SMTP transport
      this.transporter = createTransport({
        host: this.credentials.smtp.host,
        port: this.credentials.smtp.port,
        secure: this.credentials.smtp.secure,
        auth: {
          user: this.credentials.smtp.user,
          pass: this.credentials.smtp.password,
        },
      })

      // Verify SMTP connection
      await this.transporter.verify()

      log.messaging.info('SMTP connection verified', {
        connectionId: this.connectionId,
        host: this.credentials.smtp.host,
      })

      // Setup IMAP client
      this.imapClient = new ImapFlow({
        host: this.credentials.imap.host,
        port: this.credentials.imap.port,
        secure: this.credentials.imap.secure,
        auth: {
          user: this.credentials.imap.user,
          pass: this.credentials.imap.password,
        },
        logger: false, // Disable verbose logging
      })

      // Connect to IMAP
      await this.imapClient.connect()

      log.messaging.info('IMAP connection established', {
        connectionId: this.connectionId,
        host: this.credentials.imap.host,
      })

      // Get the last UID from INBOX to avoid processing old emails
      await this.imapClient.mailboxOpen('INBOX')
      const status = await this.imapClient.status('INBOX', { uidNext: true })
      this.lastSeenUid = (status.uidNext ?? 1) - 1
      await this.imapClient.logout()

      this.updateStatus('connected')

      // Start IMAP polling
      this.startPolling()
    } catch (err) {
      log.messaging.error('Email connect error', {
        connectionId: this.connectionId,
        error: String(err),
      })
      this.updateStatus('disconnected')
    }
  }

  private startPolling(): void {
    if (this.pollTimer || !this.credentials) return

    const intervalMs = (this.credentials.pollIntervalSeconds || 30) * 1000

    log.messaging.info('Starting IMAP polling', {
      connectionId: this.connectionId,
      intervalMs,
    })

    // Initial poll
    this.pollForNewEmails()

    // Schedule regular polling
    this.pollTimer = setInterval(() => {
      this.pollForNewEmails()
    }, intervalMs)
  }

  private async pollForNewEmails(): Promise<void> {
    if (this.isShuttingDown || !this.credentials) return

    try {
      // Create new IMAP connection for polling
      const client = new ImapFlow({
        host: this.credentials.imap.host,
        port: this.credentials.imap.port,
        secure: this.credentials.imap.secure,
        auth: {
          user: this.credentials.imap.user,
          pass: this.credentials.imap.password,
        },
        logger: false,
      })

      await client.connect()
      const lock = await client.getMailboxLock('INBOX')

      try {
        // Search for unseen emails with UID greater than last seen
        const searchQuery = this.lastSeenUid > 0
          ? { uid: `${this.lastSeenUid + 1}:*`, seen: false }
          : { seen: false }

        for await (const message of client.fetch(searchQuery, {
          uid: true,
          envelope: true,
          source: true,
        })) {
          // Skip if we've already processed this UID
          if (message.uid <= this.lastSeenUid) continue

          this.lastSeenUid = Math.max(this.lastSeenUid, message.uid)

          const envelope = message.envelope
          const fromAddress = envelope?.from?.[0]?.address

          if (!fromAddress) continue

          // Skip emails from ourselves (to avoid loops)
          if (fromAddress.toLowerCase() === this.credentials!.smtp.user.toLowerCase()) {
            continue
          }

          // Parse email content
          const content = await this.parseEmailContent(message.source)
          if (!content) continue

          const incomingMessage: IncomingMessage = {
            channelType: 'email',
            connectionId: this.connectionId,
            senderId: fromAddress,
            senderName: envelope?.from?.[0]?.name || undefined,
            content,
            timestamp: envelope?.date ? new Date(envelope.date) : new Date(),
          }

          log.messaging.info('Email received', {
            connectionId: this.connectionId,
            from: fromAddress,
            subject: envelope?.subject,
            contentLength: content.length,
          })

          // Mark as read
          await client.messageFlagsAdd({ uid: message.uid }, ['\\Seen'])

          // Process message
          try {
            await this.events?.onMessage(incomingMessage)
          } catch (err) {
            log.messaging.error('Error processing email message', {
              connectionId: this.connectionId,
              error: String(err),
            })
          }
        }
      } finally {
        lock.release()
      }

      await client.logout()
    } catch (err) {
      log.messaging.error('IMAP poll error', {
        connectionId: this.connectionId,
        error: String(err),
      })

      // Don't change status for transient errors, but log them
      if (String(err).includes('AUTHENTICATIONFAILED') || String(err).includes('LOGIN')) {
        this.updateStatus('credentials_required')
      }
    }
  }

  private async parseEmailContent(source: Buffer): Promise<string | null> {
    try {
      const raw = source.toString('utf-8')

      // Find the content after headers (double newline)
      const headerEnd = raw.indexOf('\r\n\r\n')
      if (headerEnd === -1) return null

      let content = raw.slice(headerEnd + 4)

      // Handle multipart emails - extract text/plain part
      const contentTypeMatch = raw.match(/Content-Type:\s*([^;\r\n]+)/i)
      const contentType = contentTypeMatch?.[1]?.toLowerCase() || ''

      if (contentType.includes('multipart')) {
        // Extract boundary
        const boundaryMatch = raw.match(/boundary="?([^"\r\n;]+)"?/i)
        if (boundaryMatch) {
          const boundary = boundaryMatch[1]
          const parts = content.split(`--${boundary}`)

          // Find text/plain part
          for (const part of parts) {
            if (part.toLowerCase().includes('content-type: text/plain')) {
              const partContentStart = part.indexOf('\r\n\r\n')
              if (partContentStart !== -1) {
                content = part.slice(partContentStart + 4)
                break
              }
            }
          }
        }
      }

      // Handle quoted-printable encoding
      if (raw.toLowerCase().includes('content-transfer-encoding: quoted-printable')) {
        content = this.decodeQuotedPrintable(content)
      }

      // Handle base64 encoding
      if (raw.toLowerCase().includes('content-transfer-encoding: base64')) {
        content = Buffer.from(content.replace(/\s/g, ''), 'base64').toString('utf-8')
      }

      // Clean up the content
      content = this.cleanEmailContent(content)

      return content.trim() || null
    } catch (err) {
      log.messaging.error('Failed to parse email content', {
        connectionId: this.connectionId,
        error: String(err),
      })
      return null
    }
  }

  private decodeQuotedPrintable(str: string): string {
    return str
      .replace(/=\r?\n/g, '') // Remove soft line breaks
      .replace(/=([0-9A-F]{2})/gi, (_, hex) => String.fromCharCode(parseInt(hex, 16)))
  }

  private cleanEmailContent(content: string): string {
    let cleaned = content

    // Strip signatures
    for (const pattern of SIGNATURE_PATTERNS) {
      const match = cleaned.match(pattern)
      if (match) {
        cleaned = cleaned.slice(0, match.index)
      }
    }

    // Strip quoted replies
    for (const pattern of QUOTED_REPLY_PATTERNS) {
      const match = cleaned.match(pattern)
      if (match && match.index !== undefined) {
        cleaned = cleaned.slice(0, match.index)
      }
    }

    // Normalize whitespace
    cleaned = cleaned
      .replace(/\r\n/g, '\n')
      .replace(/\n{3,}/g, '\n\n')
      .trim()

    return cleaned
  }

  async shutdown(): Promise<void> {
    this.isShuttingDown = true

    if (this.pollTimer) {
      clearInterval(this.pollTimer)
      this.pollTimer = null
    }

    if (this.imapClient) {
      try {
        await this.imapClient.logout()
      } catch {
        // Ignore logout errors
      }
      this.imapClient = null
    }

    if (this.transporter) {
      this.transporter.close()
      this.transporter = null
    }

    this.updateStatus('disconnected')
    log.messaging.info('Email channel shutdown', {
      connectionId: this.connectionId,
    })
  }

  async sendMessage(recipientId: string, content: string): Promise<boolean> {
    if (!this.transporter || !this.credentials) {
      log.messaging.warn('Cannot send email - not connected', {
        connectionId: this.connectionId,
        status: this.status,
      })
      return false
    }

    try {
      // Convert markdown-like formatting to HTML
      const htmlContent = this.formatAsHtml(content)

      await this.transporter.sendMail({
        from: this.credentials.smtp.user,
        to: recipientId,
        subject: 'Re: Fulcrum AI Assistant',
        text: content,
        html: htmlContent,
      })

      log.messaging.info('Email sent', {
        connectionId: this.connectionId,
        to: recipientId,
        contentLength: content.length,
      })

      return true
    } catch (err) {
      log.messaging.error('Failed to send email', {
        connectionId: this.connectionId,
        to: recipientId,
        error: String(err),
      })
      return false
    }
  }

  private formatAsHtml(content: string): string {
    // Basic markdown to HTML conversion
    let html = content
      // Escape HTML
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      // Code blocks
      .replace(/```(\w*)\n([\s\S]*?)```/g, '<pre><code>$2</code></pre>')
      // Inline code
      .replace(/`([^`]+)`/g, '<code>$1</code>')
      // Bold
      .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
      // Italic
      .replace(/\*([^*]+)\*/g, '<em>$1</em>')
      // Links
      .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2">$1</a>')
      // Headers
      .replace(/^### (.+)$/gm, '<h3>$1</h3>')
      .replace(/^## (.+)$/gm, '<h2>$1</h2>')
      .replace(/^# (.+)$/gm, '<h1>$1</h1>')
      // Line breaks
      .replace(/\n\n/g, '</p><p>')
      .replace(/\n/g, '<br>')

    return `<div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6;"><p>${html}</p></div>`
  }

  getStatus(): ConnectionStatus {
    return this.status
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
}

/**
 * Test email credentials without saving them.
 * Returns true if both SMTP and IMAP connections succeed.
 */
export async function testEmailCredentials(credentials: EmailAuthState): Promise<{
  success: boolean
  smtpOk: boolean
  imapOk: boolean
  error?: string
}> {
  let smtpOk = false
  let imapOk = false

  // Test SMTP
  try {
    const transporter = createTransport({
      host: credentials.smtp.host,
      port: credentials.smtp.port,
      secure: credentials.smtp.secure,
      auth: {
        user: credentials.smtp.user,
        pass: credentials.smtp.password,
      },
    })

    await transporter.verify()
    smtpOk = true
    transporter.close()
  } catch (err) {
    return {
      success: false,
      smtpOk: false,
      imapOk: false,
      error: `SMTP error: ${String(err)}`,
    }
  }

  // Test IMAP
  try {
    const client = new ImapFlow({
      host: credentials.imap.host,
      port: credentials.imap.port,
      secure: credentials.imap.secure,
      auth: {
        user: credentials.imap.user,
        pass: credentials.imap.password,
      },
      logger: false,
    })

    await client.connect()
    await client.logout()
    imapOk = true
  } catch (err) {
    return {
      success: false,
      smtpOk: true,
      imapOk: false,
      error: `IMAP error: ${String(err)}`,
    }
  }

  return {
    success: true,
    smtpOk: true,
    imapOk: true,
  }
}
