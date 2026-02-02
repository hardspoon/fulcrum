/**
 * Restricted MCP endpoints for untrusted contexts.
 *
 * /mcp/observer — only memory tools (memory_store, memory_search).
 * Used for observe-only channel messages where the input is untrusted
 * third-party content (non-self WhatsApp chats, unauthorized emails).
 */
import { Hono } from 'hono'
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { WebStandardStreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js'
import { registerMemoryTools } from '../../cli/src/mcp/tools/memory'
import { registerMemoryFileTools } from '../../cli/src/mcp/tools/memory-file'
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
  registerMemoryTools(server, client)
  registerMemoryFileTools(server, client)

  await server.connect(transport)

  return transport.handleRequest(c.req.raw)
})

export default mcpObserverRoutes
