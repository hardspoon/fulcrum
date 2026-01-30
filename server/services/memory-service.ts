import { db } from '../db'
import { memories } from '../db/schema'
import { eq, desc, sql } from 'drizzle-orm'
import { nanoid } from 'nanoid'

export interface StoreMemoryInput {
  content: string
  tags?: string[]
}

export interface SearchMemoriesInput {
  query: string
  tags?: string[]
  limit?: number
}

export interface ListMemoriesInput {
  tags?: string[]
  limit?: number
  offset?: number
}

export interface MemoryResult {
  id: string
  content: string
  tags: string[] | null
  createdAt: string
  updatedAt: string
  rank?: number
}

function parseTags(tagsJson: string | null): string[] | null {
  if (!tagsJson) return null
  try {
    return JSON.parse(tagsJson)
  } catch {
    return null
  }
}

function toResult(row: typeof memories.$inferSelect, rank?: number): MemoryResult {
  return {
    id: row.id,
    content: row.content,
    tags: parseTags(row.tags),
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    ...(rank !== undefined ? { rank } : {}),
  }
}

export async function storeMemory(input: StoreMemoryInput): Promise<MemoryResult> {
  const now = new Date().toISOString()
  const id = nanoid()
  const tagsJson = input.tags?.length ? JSON.stringify(input.tags) : null

  const [row] = await db
    .insert(memories)
    .values({
      id,
      content: input.content,
      tags: tagsJson,
      createdAt: now,
      updatedAt: now,
    })
    .returning()

  return toResult(row)
}

export async function searchMemories(input: SearchMemoriesInput): Promise<MemoryResult[]> {
  const limit = input.limit ?? 20

  // Build FTS5 query - use the query as-is since FTS5 supports boolean operators natively
  const ftsQuery = input.query

  // If tag filtering is requested, we need to join and filter
  if (input.tags?.length) {
    const tagPlaceholders = input.tags.map(() => '?').join(', ')
    const rawSql = sql.raw(`
      SELECT m.*, bm25(memories_fts) as rank
      FROM memories_fts fts
      JOIN memories m ON m.rowid = fts.rowid
      WHERE memories_fts MATCH ${sql.placeholder('query')}
        AND EXISTS (
          SELECT 1 FROM json_each(m.tags) je
          WHERE je.value IN (${tagPlaceholders})
        )
      ORDER BY bm25(memories_fts)
      LIMIT ${sql.placeholder('limit')}
    `)
    // Use raw SQL via the underlying database
    const results = db.all(
      sql`SELECT m.id, m.content, m.tags, m.created_at as "createdAt", m.updated_at as "updatedAt", bm25(memories_fts) as rank
          FROM memories_fts fts
          JOIN memories m ON m.rowid = fts.rowid
          WHERE memories_fts MATCH ${ftsQuery}
            AND EXISTS (
              SELECT 1 FROM json_each(m.tags) je
              WHERE je.value IN ${input.tags}
            )
          ORDER BY bm25(memories_fts)
          LIMIT ${limit}`
    ) as MemoryResult[]

    return results.map((r) => ({
      ...r,
      tags: parseTags(r.tags as unknown as string),
    }))
  }

  // Simple FTS5 search without tag filtering
  const results = db.all(
    sql`SELECT m.id, m.content, m.tags, m.created_at as "createdAt", m.updated_at as "updatedAt", bm25(memories_fts) as rank
        FROM memories_fts fts
        JOIN memories m ON m.rowid = fts.rowid
        WHERE memories_fts MATCH ${ftsQuery}
        ORDER BY bm25(memories_fts)
        LIMIT ${limit}`
  ) as MemoryResult[]

  return results.map((r) => ({
    ...r,
    tags: parseTags(r.tags as unknown as string),
  }))
}

export interface UpdateMemoryInput {
  content?: string
  tags?: string[] | null
}

export async function updateMemory(id: string, input: UpdateMemoryInput): Promise<MemoryResult | null> {
  const now = new Date().toISOString()

  const updates: Record<string, unknown> = { updatedAt: now }
  if (input.content !== undefined) updates.content = input.content
  if (input.tags !== undefined) updates.tags = input.tags?.length ? JSON.stringify(input.tags) : null

  const [row] = await db
    .update(memories)
    .set({
      ...(input.content !== undefined ? { content: input.content } : {}),
      ...(input.tags !== undefined ? { tags: input.tags?.length ? JSON.stringify(input.tags) : null } : {}),
      updatedAt: now,
    })
    .where(eq(memories.id, id))
    .returning()

  if (!row) return null
  return toResult(row)
}

export async function deleteMemory(id: string): Promise<boolean> {
  const result = await db.delete(memories).where(eq(memories.id, id)).returning()
  return result.length > 0
}

export async function listMemories(input: ListMemoriesInput = {}): Promise<{ memories: MemoryResult[]; total: number }> {
  const limit = input.limit ?? 50
  const offset = input.offset ?? 0

  if (input.tags?.length) {
    // Filter by tags using json_each
    const rows = db.all(
      sql`SELECT m.id, m.content, m.tags, m.created_at as "createdAt", m.updated_at as "updatedAt"
          FROM memories m
          WHERE EXISTS (
            SELECT 1 FROM json_each(m.tags) je
            WHERE je.value IN ${input.tags}
          )
          ORDER BY m.created_at DESC
          LIMIT ${limit} OFFSET ${offset}`
    ) as MemoryResult[]

    const [countResult] = db.all(
      sql`SELECT COUNT(*) as count FROM memories m
          WHERE EXISTS (
            SELECT 1 FROM json_each(m.tags) je
            WHERE je.value IN ${input.tags}
          )`
    ) as [{ count: number }]

    return {
      memories: rows.map((r) => ({
        ...r,
        tags: parseTags(r.tags as unknown as string),
      })),
      total: countResult.count,
    }
  }

  const rows = await db
    .select()
    .from(memories)
    .orderBy(desc(memories.createdAt))
    .limit(limit)
    .offset(offset)

  const [countResult] = db.all(
    sql`SELECT COUNT(*) as count FROM memories`
  ) as [{ count: number }]

  return {
    memories: rows.map((r) => toResult(r)),
    total: countResult.count,
  }
}
