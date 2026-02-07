/**
 * Restricted MCP endpoints for untrusted contexts.
 *
 * /mcp/observer — observer-safe memory tools (store, search, list — no delete),
 * read-only memory file access (no write), and observer-safe task tools
 * (list, create, update, add link/tag/due date — no delete, no filesystem).
 * Used for observe-only channel messages where the input is untrusted
 * third-party content (non-self WhatsApp chats, unauthorized emails).
 */
import { Hono } from 'hono'
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { WebStandardStreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js'
import { registerMemoryObserverTools } from '../../cli/src/mcp/tools/memory'
import { registerMemoryFileReadTool } from '../../cli/src/mcp/tools/memory-file'
import { registerTaskObserverTools } from '../../cli/src/mcp/tools/tasks'
import { registerNotificationTools } from '../../cli/src/mcp/tools/notifications'
import { FulcrumClient } from '../../cli/src/client'
import { getSettings } from '../lib/settings'

const mcpObserverRoutes = new Hono()

mcpObserverRoutes.all('/', async (c) => {
  const settings = getSettings()
  const port = settings.server?.port ?? 7777

  const transport = new WebStandardStreamableHTTPServerTransport({
    sessionIdGenerator: undefined,
  })

  const server = new McpServer({
    name: 'fulcrum-observer',
    version: '2.12.0',
  })

  const client = new FulcrumClient(`http://localhost:${port}`)
  registerMemoryObserverTools(server, client)
  registerMemoryFileReadTool(server, client)
  registerTaskObserverTools(server, client)
  registerNotificationTools(server, client)

  await server.connect(transport)

  return transport.handleRequest(c.req.raw)
})

export default mcpObserverRoutes
