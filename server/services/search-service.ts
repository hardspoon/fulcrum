import { db } from '../db'
import { sql } from 'drizzle-orm'

export interface SearchOptions {
  query: string
  entities?: ('tasks' | 'projects' | 'messages' | 'events' | 'memories')[]
  limit?: number
  // Entity-specific filters
  taskStatus?: string[]
  projectStatus?: 'active' | 'archived'
  messageChannel?: string
  messageDirection?: 'incoming' | 'outgoing'
  eventFrom?: string
  eventTo?: string
  memoryTags?: string[]
}

export interface SearchResult {
  entityType: 'task' | 'project' | 'message' | 'event' | 'memory'
  id: string
  title: string
  snippet: string
  score: number
  metadata: Record<string, unknown>
}

const ALL_ENTITIES: SearchOptions['entities'] = ['tasks', 'projects', 'messages', 'events', 'memories']

export async function search(options: SearchOptions): Promise<SearchResult[]> {
  const entities = options.entities?.length ? options.entities : ALL_ENTITIES
  const limit = options.limit ?? 10

  const searches = entities!.map((entity) => {
    switch (entity) {
      case 'tasks':
        return searchTasks(options.query, { status: options.taskStatus }, limit)
      case 'projects':
        return searchProjects(options.query, { status: options.projectStatus }, limit)
      case 'messages':
        return searchMessages(options.query, { channel: options.messageChannel, direction: options.messageDirection }, limit)
      case 'events':
        return searchEvents(options.query, { from: options.eventFrom, to: options.eventTo }, limit)
      case 'memories':
        return searchMemories(options.query, { tags: options.memoryTags }, limit)
    }
  })

  const resultSets = await Promise.all(searches)

  // Flatten and sort by score descending
  return resultSets.flat().sort((a, b) => b.score - a.score)
}

interface TaskRow {
  id: string
  title: string
  description: string | null
  status: string
  rank: number
  tags: string | null
  dueDate: string | null
  projectId: string | null
}

export async function searchTasks(
  query: string,
  filters: { status?: string[] },
  limit: number
): Promise<SearchResult[]> {
  const statusFilter = filters.status?.length
    ? sql`AND t.status IN ${filters.status}`
    : sql``

  const rows = db.all(
    sql`SELECT t.id, t.title, t.description, t.status, t.due_date as "dueDate", t.project_id as "projectId",
        bm25(tasks_fts, 10.0, 2.0, 1.0, 5.0) as rank,
        COALESCE((SELECT GROUP_CONCAT(tg.name, ', ') FROM task_tags tt JOIN tags tg ON tg.id = tt.tag_id WHERE tt.task_id = t.id), '') as tags
        FROM tasks_fts fts
        JOIN tasks t ON t.rowid = fts.rowid
        WHERE tasks_fts MATCH ${query}
          ${statusFilter}
        ORDER BY bm25(tasks_fts, 10.0, 2.0, 1.0, 5.0)
        LIMIT ${limit}`
  ) as TaskRow[]

  if (!rows.length) return []

  // Normalize scores: bm25 returns negative values (lower = better match)
  const minRank = Math.min(...rows.map((r) => r.rank))
  const maxRank = Math.max(...rows.map((r) => r.rank))
  const range = maxRank - minRank || 1

  return rows.map((r) => ({
    entityType: 'task' as const,
    id: r.id,
    title: r.title,
    snippet: r.description?.slice(0, 200) ?? '',
    score: 1 - (r.rank - minRank) / range, // Normalize to 0-1, higher = better
    metadata: {
      status: r.status,
      tags: r.tags || undefined,
      dueDate: r.dueDate || undefined,
      projectId: r.projectId || undefined,
    },
  }))
}

interface ProjectRow {
  id: string
  name: string
  description: string | null
  status: string
  rank: number
}

export async function searchProjects(
  query: string,
  filters: { status?: 'active' | 'archived' },
  limit: number
): Promise<SearchResult[]> {
  const statusFilter = filters.status
    ? sql`AND p.status = ${filters.status}`
    : sql``

  const rows = db.all(
    sql`SELECT p.id, p.name, p.description, p.status,
        bm25(projects_fts, 10.0, 2.0, 1.0) as rank
        FROM projects_fts fts
        JOIN projects p ON p.rowid = fts.rowid
        WHERE projects_fts MATCH ${query}
          ${statusFilter}
        ORDER BY bm25(projects_fts, 10.0, 2.0, 1.0)
        LIMIT ${limit}`
  ) as ProjectRow[]

  if (!rows.length) return []

  const minRank = Math.min(...rows.map((r) => r.rank))
  const maxRank = Math.max(...rows.map((r) => r.rank))
  const range = maxRank - minRank || 1

  return rows.map((r) => ({
    entityType: 'project' as const,
    id: r.id,
    title: r.name,
    snippet: r.description?.slice(0, 200) ?? '',
    score: 1 - (r.rank - minRank) / range,
    metadata: {
      status: r.status,
    },
  }))
}

interface MessageRow {
  id: string
  content: string
  senderName: string | null
  channelType: string
  direction: string
  messageTimestamp: string
  subject: string | null
  rank: number
}

export async function searchMessages(
  query: string,
  filters: { channel?: string; direction?: 'incoming' | 'outgoing' },
  limit: number
): Promise<SearchResult[]> {
  const channelFilter = filters.channel
    ? sql`AND m.channel_type = ${filters.channel}`
    : sql``
  const directionFilter = filters.direction
    ? sql`AND m.direction = ${filters.direction}`
    : sql``

  const rows = db.all(
    sql`SELECT m.id, m.content, m.sender_name as "senderName", m.channel_type as "channelType",
        m.direction, m.message_timestamp as "messageTimestamp",
        COALESCE(json_extract(m.metadata, '$.subject'), '') as subject,
        bm25(channel_messages_fts, 1.0, 2.0, 3.0) as rank
        FROM channel_messages_fts fts
        JOIN channel_messages m ON m.rowid = fts.rowid
        WHERE channel_messages_fts MATCH ${query}
          ${channelFilter}
          ${directionFilter}
        ORDER BY bm25(channel_messages_fts, 1.0, 2.0, 3.0)
        LIMIT ${limit}`
  ) as MessageRow[]

  if (!rows.length) return []

  const minRank = Math.min(...rows.map((r) => r.rank))
  const maxRank = Math.max(...rows.map((r) => r.rank))
  const range = maxRank - minRank || 1

  return rows.map((r) => ({
    entityType: 'message' as const,
    id: r.id,
    title: r.subject || `${r.channelType} message from ${r.senderName || 'unknown'}`,
    snippet: r.content.slice(0, 200),
    score: 1 - (r.rank - minRank) / range,
    metadata: {
      channelType: r.channelType,
      direction: r.direction,
      senderName: r.senderName || undefined,
      timestamp: r.messageTimestamp,
    },
  }))
}

interface EventRow {
  id: string
  summary: string | null
  description: string | null
  location: string | null
  dtstart: string | null
  dtend: string | null
  allDay: boolean | null
  rank: number
}

export async function searchEvents(
  query: string,
  filters: { from?: string; to?: string },
  limit: number
): Promise<SearchResult[]> {
  const fromFilter = filters.from
    ? sql`AND e.dtstart >= ${filters.from}`
    : sql``
  const toFilter = filters.to
    ? sql`AND e.dtstart <= ${filters.to}`
    : sql``

  const rows = db.all(
    sql`SELECT e.id, e.summary, e.description, e.location, e.dtstart, e.dtend,
        e.all_day as "allDay",
        bm25(caldav_events_fts, 10.0, 2.0, 3.0) as rank
        FROM caldav_events_fts fts
        JOIN caldav_events e ON e.rowid = fts.rowid
        WHERE caldav_events_fts MATCH ${query}
          ${fromFilter}
          ${toFilter}
        ORDER BY bm25(caldav_events_fts, 10.0, 2.0, 3.0)
        LIMIT ${limit}`
  ) as EventRow[]

  if (!rows.length) return []

  const minRank = Math.min(...rows.map((r) => r.rank))
  const maxRank = Math.max(...rows.map((r) => r.rank))
  const range = maxRank - minRank || 1

  return rows.map((r) => ({
    entityType: 'event' as const,
    id: r.id,
    title: r.summary || 'Untitled event',
    snippet: r.description?.slice(0, 200) ?? (r.location ? `Location: ${r.location}` : ''),
    score: 1 - (r.rank - minRank) / range,
    metadata: {
      dtstart: r.dtstart || undefined,
      dtend: r.dtend || undefined,
      location: r.location || undefined,
      allDay: r.allDay || undefined,
    },
  }))
}

interface MemoryRow {
  id: string
  content: string
  tags: string | null
  source: string | null
  createdAt: string
  rank: number
}

function parseTags(tagsJson: string | null): string[] | null {
  if (!tagsJson) return null
  try {
    return JSON.parse(tagsJson)
  } catch {
    return null
  }
}

export async function searchMemories(
  query: string,
  filters: { tags?: string[] },
  limit: number
): Promise<SearchResult[]> {
  const tagFilter = filters.tags?.length
    ? sql`AND EXISTS (
        SELECT 1 FROM json_each(m.tags) je
        WHERE je.value IN ${filters.tags}
      )`
    : sql``

  const rows = db.all(
    sql`SELECT m.id, m.content, m.tags, m.source, m.created_at as "createdAt",
        bm25(memories_fts) as rank
        FROM memories_fts fts
        JOIN memories m ON m.rowid = fts.rowid
        WHERE memories_fts MATCH ${query}
          ${tagFilter}
        ORDER BY bm25(memories_fts) * (1.0 / (1.0 + (julianday('now') - julianday(m.created_at))))
        LIMIT ${limit}`
  ) as MemoryRow[]

  if (!rows.length) return []

  const minRank = Math.min(...rows.map((r) => r.rank))
  const maxRank = Math.max(...rows.map((r) => r.rank))
  const range = maxRank - minRank || 1

  return rows.map((r) => ({
    entityType: 'memory' as const,
    id: r.id,
    title: r.content.slice(0, 80),
    snippet: r.content.slice(0, 200),
    score: 1 - (r.rank - minRank) / range,
    metadata: {
      tags: parseTags(r.tags) || undefined,
      source: r.source || undefined,
      createdAt: r.createdAt,
    },
  }))
}

/**
 * Reindex a single task's FTS entry with current tags.
 * Called from tag mutation routes since tag changes don't trigger tasks table UPDATE.
 */
export function reindexTaskFTS(taskId: string): void {
  db.run(sql`
    UPDATE tasks SET updated_at = updated_at WHERE id = ${taskId}
  `)
}
