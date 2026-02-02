/**
 * API routes for the master memory file (MEMORY.md)
 */
import { Hono } from 'hono'
import { readMemoryFile, writeMemoryFile, updateMemoryFileSection, getMemoryFilePath } from '../services/memory-file-service'

const memoryFileRoutes = new Hono()

// GET / — read the memory file
memoryFileRoutes.get('/', (c) => {
  const content = readMemoryFile()
  const path = getMemoryFilePath()
  return c.json({ content, path })
})

// PUT / — write the entire memory file
memoryFileRoutes.put('/', async (c) => {
  const { content } = await c.req.json<{ content: string }>()
  writeMemoryFile(content)
  return c.json({ success: true })
})

// PATCH /section — update a specific section by heading
memoryFileRoutes.patch('/section', async (c) => {
  const { heading, content } = await c.req.json<{ heading: string; content: string }>()
  if (!heading) {
    return c.json({ error: 'heading is required' }, 400)
  }
  updateMemoryFileSection(heading, content)
  return c.json({ success: true })
})

export default memoryFileRoutes
