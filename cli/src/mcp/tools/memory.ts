/**
 * Memory MCP tools - Store and search persistent knowledge
 */
import { z } from 'zod'
import type { ToolRegistrar } from './types'
import { formatSuccess, handleToolError } from '../utils'
import { MEMORY_SOURCES } from '@shared/types'

export const registerMemoryTools: ToolRegistrar = (server, client) => {
  // memory_store - Store a memory
  server.tool(
    'memory_store',
    'Store a piece of knowledge in persistent memory. Use this to remember facts, preferences, decisions, patterns, or any information that should persist across conversations.',
    {
      content: z.string().describe('The memory content to store. Be specific and self-contained.'),
      tags: z.optional(z.array(z.string())).describe('Optional tags for categorization (e.g., ["preference", "architecture", "decision"])'),
      source: z.optional(z.enum(MEMORY_SOURCES)).describe('Where this memory originated (e.g., "channel:whatsapp", "conversation:assistant")'),
    },
    async ({ content, tags, source }) => {
      try {
        const result = await client.storeMemory({ content, tags, source })
        return formatSuccess(result)
      } catch (err) {
        return handleToolError(err)
      }
    }
  )

}
