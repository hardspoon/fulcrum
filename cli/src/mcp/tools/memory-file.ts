/**
 * Memory File MCP tools - Read and update the master MEMORY.md file
 */
import { z } from 'zod'
import type { ToolRegistrar } from './types'
import { formatSuccess, handleToolError } from '../utils'

export const registerMemoryFileTools: ToolRegistrar = (server, client) => {
  // memory_file_read - Read the full memory file
  server.tool(
    'memory_file_read',
    'Read the master memory file (MEMORY.md). This file contains persistent knowledge, user preferences, and instructions that are included in every conversation.',
    {},
    async () => {
      try {
        const result = await client.readMemoryFile()
        return formatSuccess(result)
      } catch (err) {
        return handleToolError(err)
      }
    }
  )

  // memory_file_update - Update the memory file (whole or by section)
  server.tool(
    'memory_file_update',
    'Update the master memory file. Provide full content to replace the entire file, or specify a section heading to update just that section. The memory file is included in every conversation, so keep it organized and concise.',
    {
      content: z.string().describe('The content to write. If section is specified, this replaces only that section body.'),
      section: z.optional(z.string()).describe('Optional markdown heading (e.g., "## Preferences") to update a specific section. If omitted, replaces the entire file.'),
    },
    async ({ content, section }) => {
      try {
        if (section) {
          await client.updateMemoryFileSection(section, content)
        } else {
          await client.writeMemoryFile(content)
        }
        return formatSuccess({ success: true })
      } catch (err) {
        return handleToolError(err)
      }
    }
  )
}
