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
 * Send a message to a channel.
 * Unified interface for sending messages across all supported channels.
 */
export async function sendMessageToChannel(
  channel: 'email' | 'whatsapp' | 'discord' | 'telegram' | 'slack',
  to: string,
  body: string,
  options?: {
    subject?: string
    replyToMessageId?: string
    slackBlocks?: Array<Record<string, unknown>>
  }
): Promise<{ success: boolean; messageId?: string; error?: string }> {
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
        await sendWhatsAppMessage(to, body)
        log.messaging.info('Sent WhatsApp message', { to })

        // Store outgoing message
        storeChannelMessage({
          channelType: 'whatsapp',
          connectionId: waStatus.id,
          direction: 'outgoing',
          senderId: waStatus.displayName || 'self',
          recipientId: to,
          content: body,
          messageTimestamp: new Date(),
        })

        return { success: true }
      } catch (err) {
        log.messaging.error('Failed to send WhatsApp message', { to, error: String(err) })
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
        const success = await discordChannel.sendMessage(to, body)
        if (success) {
          log.messaging.info('Sent Discord message', { to })

          // Store outgoing message
          storeChannelMessage({
            channelType: 'discord',
            connectionId: DISCORD_CONNECTION_ID,
            direction: 'outgoing',
            senderId: discordStatus.displayName || 'bot',
            recipientId: to,
            content: body,
            messageTimestamp: new Date(),
          })

          return { success: true }
        } else {
          return { success: false, error: 'Failed to send Discord message' }
        }
      } catch (err) {
        log.messaging.error('Failed to send Discord message', { to, error: String(err) })
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
        const success = await telegramChannel.sendMessage(to, body)
        if (success) {
          log.messaging.info('Sent Telegram message', { to })

          // Store outgoing message
          storeChannelMessage({
            channelType: 'telegram',
            connectionId: TELEGRAM_CONNECTION_ID,
            direction: 'outgoing',
            senderId: telegramStatus.displayName || 'bot',
            recipientId: to,
            content: body,
            messageTimestamp: new Date(),
          })

          return { success: true }
        } else {
          return { success: false, error: 'Failed to send Telegram message' }
        }
      } catch (err) {
        log.messaging.error('Failed to send Telegram message', { to, error: String(err) })
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
        // Pass blocks metadata for Block Kit formatting
        const msgMetadata = options?.slackBlocks ? { blocks: options.slackBlocks } : undefined
        const success = await slackChannel.sendMessage(to, body, msgMetadata)
        if (success) {
          log.messaging.info('Sent Slack message', { to, hasBlocks: !!options?.slackBlocks })

          // Store outgoing message
          storeChannelMessage({
            channelType: 'slack',
            connectionId: SLACK_CONNECTION_ID,
            direction: 'outgoing',
            senderId: slackStatus.displayName || 'bot',
            recipientId: to,
            content: body,
            metadata: msgMetadata,
            messageTimestamp: new Date(),
          })

          return { success: true }
        } else {
          return { success: false, error: 'Failed to send Slack message' }
        }
      } catch (err) {
        log.messaging.error('Failed to send Slack message', { to, error: String(err) })
        return { success: false, error: String(err) }
      }
    }

    default:
      return { success: false, error: `Unknown channel: ${channel}` }
  }
}
