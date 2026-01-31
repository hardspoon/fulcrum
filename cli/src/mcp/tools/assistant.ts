/**
 * Assistant MCP tools - Messaging and sweeps
 */
import { z } from 'zod'
import type { ToolRegistrar } from './types'
import { formatSuccess, handleToolError } from '../utils'

const ChannelSchema = z.enum(['email', 'whatsapp', 'discord', 'telegram', 'slack', 'all'])

export const registerAssistantTools: ToolRegistrar = (server, client) => {
  // message - Send a message to a channel
  server.tool(
    'message',
    'Send a message to a messaging channel (email, WhatsApp, etc.). Use this to reply to messages or send proactive communications.',
    {
      channel: ChannelSchema.describe('Target channel: email, whatsapp, discord, telegram, slack, or all'),
      to: z.string().describe('Recipient (email address, phone number, or channel ID)'),
      body: z.string().describe('Message content'),
      subject: z.optional(z.string()).describe('Email subject (for email channel only)'),
      replyToMessageId: z.optional(z.string()).describe('Message ID to reply to (for threading)'),
      slack_blocks: z.optional(z.array(z.record(z.string(), z.any()))).describe(
        'Slack Block Kit blocks for rich formatting (Slack channel only). Array of block objects.'
      ),
    },
    async ({ channel, to, body, subject, replyToMessageId, slack_blocks }) => {
      try {
        const result = await client.sendMessage({
          channel,
          to,
          body,
          subject,
          replyToMessageId,
          slackBlocks: slack_blocks,
        })
        return formatSuccess(result)
      } catch (err) {
        return handleToolError(err)
      }
    }
  )

  // get_last_sweep - Get the last sweep run of a type
  server.tool(
    'get_last_sweep',
    'Get information about the last sweep run of a specific type. Useful for context about what was last reviewed.',
    {
      type: z.enum(['hourly', 'morning_ritual', 'evening_ritual']).describe('Type of sweep'),
    },
    async ({ type }) => {
      try {
        const result = await client.getLastSweepRun(type)
        return formatSuccess(result || { message: 'No sweep of this type has run yet' })
      } catch (err) {
        return handleToolError(err)
      }
    }
  )
}
