import { Hono } from 'hono'
import { search } from '../services/search-service'

const app = new Hono()

// GET /api/search?q=<query>&entities=tasks,projects&limit=10&...
app.get('/', async (c) => {
  const query = c.req.query('q')
  if (!query?.trim()) {
    return c.json({ error: 'q parameter is required' }, 400)
  }

  const entitiesParam = c.req.query('entities')
  const entities = entitiesParam
    ? (entitiesParam.split(',').map((e) => e.trim()) as ('tasks' | 'projects' | 'messages' | 'events' | 'memories')[])
    : undefined

  const limitParam = c.req.query('limit')
  const limit = limitParam ? parseInt(limitParam, 10) : undefined

  const taskStatusParam = c.req.query('taskStatus')
  const taskStatus = taskStatusParam ? taskStatusParam.split(',').map((s) => s.trim()) : undefined

  const projectStatus = c.req.query('projectStatus') as 'active' | 'archived' | undefined
  const messageChannel = c.req.query('messageChannel') || undefined
  const messageDirection = c.req.query('messageDirection') as 'incoming' | 'outgoing' | undefined
  const eventFrom = c.req.query('eventFrom') || undefined
  const eventTo = c.req.query('eventTo') || undefined

  const memoryTagsParam = c.req.query('memoryTags')
  const memoryTags = memoryTagsParam ? memoryTagsParam.split(',').map((t) => t.trim()) : undefined

  try {
    const results = await search({
      query: query.trim(),
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

    return c.json(results)
  } catch (err) {
    return c.json({ error: err instanceof Error ? err.message : 'Search failed' }, 500)
  }
})

export default app
