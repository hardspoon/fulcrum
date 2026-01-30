/**
 * Memory MCP tools - Store and search persistent knowledge
 */
import { z } from 'zod'
import type { ToolRegistrar } from './types'
import { formatSuccess, handleToolError } from '../utils'

export const registerMemoryTools: ToolRegistrar = (server, client) => {
  // memory_store - Store a memory
  server.tool(
    'memory_store',
    'Store a piece of knowledge in persistent memory. Use this to remember facts, preferences, decisions, patterns, or any information that should persist across conversations.',
    {
      content: z.string().describe('The memory content to store. Be specific and self-contained.'),
      tags: z.optional(z.array(z.string())).describe('Optional tags for categorization (e.g., ["preference", "architecture", "decision"])'),
    },
    async ({ content, tags }) => {
      try {
        const result = await client.storeMemory({ content, tags })
        return formatSuccess(result)
      } catch (err) {
        return handleToolError(err)
      }
    }
  )

  // memory_search - Search memories
  server.tool(
    'memory_search',
    'Search persistent memory using full-text search. Supports boolean operators (AND, OR, NOT), phrase matching ("quoted phrases"), and prefix matching (term*). Try different search terms or synonyms if initial results are insufficient.',
    {
      query: z.string().describe('FTS5 search query. Supports: AND, OR, NOT operators, "quoted phrases", prefix* matching. Example: "user preference" OR settings'),
      tags: z.optional(z.array(z.string())).describe('Optional tag filter - only return memories with at least one of these tags'),
      limit: z.optional(z.number()).describe('Maximum results to return (default: 20)'),
    },
    async ({ query, tags, limit }) => {
      try {
        const results = await client.searchMemories({ query, tags, limit })
        return formatSuccess(results)
      } catch (err) {
        return handleToolError(err)
      }
    }
  )
}
