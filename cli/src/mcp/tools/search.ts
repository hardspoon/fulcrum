/**
 * Unified Search MCP tool - Full-text search across all entities
 */
import { z } from 'zod'
import type { ToolRegistrar } from './types'
import { formatSuccess, handleToolError } from '../utils'

const EntityTypeSchema = z.enum(['tasks', 'projects', 'messages', 'events', 'memories'])

export const registerSearchTools: ToolRegistrar = (server, client) => {
  // search - Unified full-text search across tasks, projects, messages, events, and memories
  server.tool(
    'search',
    'Search across all Fulcrum entities (tasks, projects, messages, calendar events, memories) using full-text search. Supports boolean operators (AND, OR, NOT), phrase matching ("quoted phrases"), and prefix matching (term*). Returns results ranked by relevance.',
    {
      query: z.string().describe('FTS5 search query. Supports: AND, OR, NOT operators, "quoted phrases", prefix* matching. Example: "kubernetes deployment" OR k8s'),
      entities: z.optional(z.array(EntityTypeSchema)).describe('Entity types to search. Defaults to all: tasks, projects, messages, events, memories'),
      limit: z.optional(z.number()).describe('Maximum results per entity type (default: 10)'),
      taskStatus: z.optional(z.array(z.string())).describe('Filter tasks by status (e.g., ["IN_PROGRESS", "TO_DO"])'),
      projectStatus: z.optional(z.enum(['active', 'archived'])).describe('Filter projects by status'),
      messageChannel: z.optional(z.string()).describe('Filter messages by channel type (e.g., "slack", "email", "whatsapp")'),
      messageDirection: z.optional(z.enum(['incoming', 'outgoing'])).describe('Filter messages by direction'),
      eventFrom: z.optional(z.string()).describe('Filter calendar events starting from this date (ISO 8601)'),
      eventTo: z.optional(z.string()).describe('Filter calendar events up to this date (ISO 8601)'),
      memoryTags: z.optional(z.array(z.string())).describe('Filter memories by tags'),
    },
    async ({ query, entities, limit, taskStatus, projectStatus, messageChannel, messageDirection, eventFrom, eventTo, memoryTags }) => {
      try {
        const results = await client.search({
          query,
          entities,
          limit,
          taskStatus,
          projectStatus,
          messageChannel,
          messageDirection,
          eventFrom,
          eventTo,
          memoryTags,
        })
        return formatSuccess(results)
      } catch (err) {
        return handleToolError(err)
      }
    }
  )

}
