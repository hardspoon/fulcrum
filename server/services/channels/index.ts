/**
 * Channel Manager - Orchestrates messaging channels and routes messages to AI assistant.
 * Entry point for the messaging service layer.
 *
 * This module re-exports all channel functionality for backward compatibility.
 * Implementation is split across:
 * - channel-manager.ts: Core lifecycle management
 * - message-handler.ts: Message routing and command handling
 * - api/*.ts: Per-channel API functions
 */

import { log } from '../../lib/logger'
import { db } from '../../db'
import { messagingConnections, messagingSessionMappings } from '../../db/schema'
import { eq, desc } from 'drizzle-orm'
import { activeChannels, DISCORD_CONNECTION_ID, TELEGRAM_CONNECTION_ID, SLACK_CONNECTION_ID } from './channel-manager'
import { storeChannelMessage } from './message-storage'
import {
  getWhatsAppStatus,
  sendWhatsAppMessage,
} from './api/whatsapp'
import {
  getDiscordStatus,
} from './api/discord'
import {
  getTelegramStatus,
} from './api/telegram'
import {
  getSlackStatus,
} from './api/slack'
// Import message-handler to register the handler with channel-manager
import './message-handler'

import { migrateSessionTitles } from './session-mapper'

// Rename existing channel sessions from "Chat with X" to "{Channel} Chat"
migrateSessionTitles()

// Re-export types
export * from './types'

// Re-export session mapper
export * from './session-mapper'

// Re-export channel manager functions
export {
  activeChannels,
  setChannelFactory,
  resetChannelFactory,
  startMessagingChannels,
  stopMessagingChannels,
  listConnections,
  SLACK_CONNECTION_ID,
  DISCORD_CONNECTION_ID,
  TELEGRAM_CONNECTION_ID,
  EMAIL_CONNECTION_ID,
} from './channel-manager'

// Re-export message handler
export { handleIncomingMessage } from './message-handler'

// Re-export WhatsApp API
export {
  getOrCreateWhatsAppConnection,
  enableWhatsApp,
  disableWhatsApp,
  requestWhatsAppAuth,
  disconnectWhatsApp,
  getWhatsAppStatus,
  sendWhatsAppMessage,
} from './api/whatsapp'

// Re-export Discord API
export {
  configureDiscord,
  enableDiscord,
  disableDiscord,
  disconnectDiscord,
  getDiscordStatus,
  getDiscordConfig,
} from './api/discord'

// Re-export Telegram API
export {
  configureTelegram,
  enableTelegram,
  disableTelegram,
  disconnectTelegram,
  getTelegramStatus,
  getTelegramConfig,
} from './api/telegram'

// Re-export Slack API
export {
  configureSlack,
  enableSlack,
  disableSlack,
  disconnectSlack,
  getSlackStatus,
  getSlackConfig,
} from './api/slack'

// Re-export Email API
export {
  configureEmail,
  testEmailCredentials,
  enableEmail,
  disableEmail,
  getEmailStatus,
  getEmailConfig,
  getStoredEmails,
  searchImapEmails,
  fetchAndStoreEmails,
} from './api/email'

/**
 * Resolve the recipient identifier for a channel by looking up stored state.
 * WhatsApp: user's own phone number from connection displayName (self-chat).
 * Slack/Discord/Telegram: most recent inbound user from session mappings.
 */
export function resolveRecipient(channel: string): string | null {
  switch (channel) {
    case 'whatsapp': {
      const row = db
        .select({ displayName: messagingConnections.displayName })
        .from(messagingConnections)
        .where(eq(messagingConnections.channelType, 'whatsapp'))
        .get()
      return row?.displayName || null
    }
    case 'slack': {
      const row = db
        .select({ channelUserId: messagingSessionMappings.channelUserId })
        .from(messagingSessionMappings)
        .where(eq(messagingSessionMappings.connectionId, SLACK_CONNECTION_ID))
        .orderBy(desc(messagingSessionMappings.lastMessageAt))
        .limit(1)
        .get()
      return row?.channelUserId || null
    }
    case 'discord': {
      const row = db
        .select({ channelUserId: messagingSessionMappings.channelUserId })
        .from(messagingSessionMappings)
        .where(eq(messagingSessionMappings.connectionId, DISCORD_CONNECTION_ID))
        .orderBy(desc(messagingSessionMappings.lastMessageAt))
        .limit(1)
        .get()
      return row?.channelUserId || null
    }
    case 'telegram': {
      const row = db
        .select({ channelUserId: messagingSessionMappings.channelUserId })
        .from(messagingSessionMappings)
        .where(eq(messagingSessionMappings.connectionId, TELEGRAM_CONNECTION_ID))
        .orderBy(desc(messagingSessionMappings.lastMessageAt))
        .limit(1)
        .get()
      return row?.channelUserId || null
    }
    default:
      return null
  }
}

/**
 * Send a message to a channel.
 * Unified interface for sending messages across all supported channels.
 * The recipient is always auto-resolved from stored channel state (the user who configured the channel).
 */
export async function sendMessageToChannel(
  channel: 'email' | 'whatsapp' | 'discord' | 'telegram' | 'slack',
  body?: string,
  options?: {
    subject?: string
    replyToMessageId?: string
    slackBlocks?: Array<Record<string, unknown>>
    filePath?: string
  }
): Promise<{ success: boolean; messageId?: string; error?: string }> {
  if (!body) {
    return { success: false, error: 'Message body is required' }
  }

  // Always resolve recipient from stored channel state (user-only messaging)
  const resolvedTo = resolveRecipient(channel) ?? undefined
  if (!resolvedTo) {
    const channelName = channel.charAt(0).toUpperCase() + channel.slice(1)
    return { success: false, error: `No ${channelName} recipient found — no user has messaged via ${channelName} yet` }
  }
  log.messaging.debug('Auto-resolved recipient', { channel, to: resolvedTo })

  switch (channel) {
    case 'email': {
      return { success: false, error: 'Email sending disabled. Use Gmail drafts instead.' }
    }

    case 'whatsapp': {
      const waStatus = getWhatsAppStatus()
      if (!waStatus?.enabled || waStatus.status !== 'connected') {
        return { success: false, error: 'WhatsApp channel not connected' }
      }

      try {
        await sendWhatsAppMessage(resolvedTo, body)
        log.messaging.info('Sent WhatsApp message', { to: resolvedTo })

        // Store outgoing message
        storeChannelMessage({
          channelType: 'whatsapp',
          connectionId: waStatus.id,
          direction: 'outgoing',
          senderId: waStatus.displayName || 'self',
          recipientId: resolvedTo,
          content: body,
          messageTimestamp: new Date(),
        })

        return { success: true }
      } catch (err) {
        log.messaging.error('Failed to send WhatsApp message', { to: resolvedTo, error: String(err) })
        return { success: false, error: String(err) }
      }
    }

    case 'discord': {
      const discordStatus = getDiscordStatus()
      if (!discordStatus?.enabled || discordStatus.status !== 'connected') {
        return { success: false, error: 'Discord channel not connected' }
      }

      // Find the active Discord channel
      const discordChannel = Array.from(activeChannels.values()).find(
        (ch) => ch.type === 'discord'
      )
      if (!discordChannel) {
        return { success: false, error: 'Discord channel not active' }
      }

      try {
        const success = await discordChannel.sendMessage(resolvedTo, body)
        if (success) {
          log.messaging.info('Sent Discord message', { to: resolvedTo })

          // Store outgoing message
          storeChannelMessage({
            channelType: 'discord',
            connectionId: DISCORD_CONNECTION_ID,
            direction: 'outgoing',
            senderId: discordStatus.displayName || 'bot',
            recipientId: resolvedTo,
            content: body,
            messageTimestamp: new Date(),
          })

          return { success: true }
        } else {
          return { success: false, error: 'Failed to send Discord message' }
        }
      } catch (err) {
        log.messaging.error('Failed to send Discord message', { to: resolvedTo, error: String(err) })
        return { success: false, error: String(err) }
      }
    }

    case 'telegram': {
      const telegramStatus = getTelegramStatus()
      if (!telegramStatus?.enabled || telegramStatus.status !== 'connected') {
        return { success: false, error: 'Telegram channel not connected' }
      }

      // Find the active Telegram channel
      const telegramChannel = Array.from(activeChannels.values()).find(
        (ch) => ch.type === 'telegram'
      )
      if (!telegramChannel) {
        return { success: false, error: 'Telegram channel not active' }
      }

      try {
        const success = await telegramChannel.sendMessage(resolvedTo, body)
        if (success) {
          log.messaging.info('Sent Telegram message', { to: resolvedTo })

          // Store outgoing message
          storeChannelMessage({
            channelType: 'telegram',
            connectionId: TELEGRAM_CONNECTION_ID,
            direction: 'outgoing',
            senderId: telegramStatus.displayName || 'bot',
            recipientId: resolvedTo,
            content: body,
            messageTimestamp: new Date(),
          })

          return { success: true }
        } else {
          return { success: false, error: 'Failed to send Telegram message' }
        }
      } catch (err) {
        log.messaging.error('Failed to send Telegram message', { to: resolvedTo, error: String(err) })
        return { success: false, error: String(err) }
      }
    }

    case 'slack': {
      const slackStatus = getSlackStatus()
      if (!slackStatus?.enabled || slackStatus.status !== 'connected') {
        return { success: false, error: 'Slack channel not connected' }
      }

      // Find the active Slack channel
      const slackChannel = Array.from(activeChannels.values()).find(
        (ch) => ch.type === 'slack'
      )
      if (!slackChannel) {
        return { success: false, error: 'Slack channel not active' }
      }

      try {
        // Pass blocks and filePath metadata for Block Kit formatting and file uploads
        const msgMetadata: Record<string, unknown> | undefined =
          (options?.slackBlocks || options?.filePath)
            ? {
                ...(options.slackBlocks && { blocks: options.slackBlocks }),
                ...(options.filePath && { filePath: options.filePath }),
              }
            : undefined
        const success = await slackChannel.sendMessage(resolvedTo, body, msgMetadata)
        if (success) {
          log.messaging.info('Sent Slack message', { to: resolvedTo, hasBlocks: !!options?.slackBlocks })

          // Store outgoing message
          storeChannelMessage({
            channelType: 'slack',
            connectionId: SLACK_CONNECTION_ID,
            direction: 'outgoing',
            senderId: slackStatus.displayName || 'bot',
            recipientId: resolvedTo,
            content: body,
            metadata: msgMetadata,
            messageTimestamp: new Date(),
          })

          return { success: true }
        } else {
          return { success: false, error: 'Failed to send Slack message' }
        }
      } catch (err) {
        log.messaging.error('Failed to send Slack message', { to: resolvedTo, error: String(err) })
        return { success: false, error: String(err) }
      }
    }

    default:
      return { success: false, error: `Unknown channel: ${channel}` }
  }
}
