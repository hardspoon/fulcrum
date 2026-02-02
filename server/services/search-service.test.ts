import { describe, test, expect, beforeEach, afterEach } from 'bun:test'
import { setupTestEnv, type TestEnv } from '../__tests__/utils/env'
import { db } from '../db'
import { sql } from 'drizzle-orm'
import { search, searchTasks, searchProjects, searchMemories, reindexTaskFTS } from './search-service'

describe('search-service', () => {
  let testEnv: TestEnv

  beforeEach(() => {
    testEnv = setupTestEnv()
  })

  afterEach(() => {
    testEnv.cleanup()
  })

  function insertTask(id: string, title: string, description: string | null = null, status = 'IN_PROGRESS') {
    const now = new Date().toISOString()
    db.run(sql`INSERT INTO tasks (id, title, description, status, position, created_at, updated_at)
      VALUES (${id}, ${title}, ${description}, ${status}, 0, ${now}, ${now})`)
  }

  function insertProject(id: string, name: string, description: string | null = null, status = 'active') {
    const now = new Date().toISOString()
    db.run(sql`INSERT INTO projects (id, name, description, status, created_at, updated_at)
      VALUES (${id}, ${name}, ${description}, ${status}, ${now}, ${now})`)
  }

  function insertMemory(id: string, content: string, tags: string | null = null) {
    const now = new Date().toISOString()
    db.run(sql`INSERT INTO memories (id, content, tags, created_at, updated_at)
      VALUES (${id}, ${content}, ${tags}, ${now}, ${now})`)
  }

  describe('searchTasks', () => {
    test('finds tasks by title', async () => {
      insertTask('t1', 'Deploy Kubernetes cluster')
      insertTask('t2', 'Fix login bug')

      const results = await searchTasks('kubernetes', {}, 10)
      expect(results).toHaveLength(1)
      expect(results[0].id).toBe('t1')
      expect(results[0].entityType).toBe('task')
    })

    test('finds tasks by description', async () => {
      insertTask('t1', 'Setup infrastructure', 'We need to deploy kubernetes on AWS')

      const results = await searchTasks('kubernetes', {}, 10)
      expect(results).toHaveLength(1)
      expect(results[0].id).toBe('t1')
    })

    test('filters by status', async () => {
      insertTask('t1', 'Deploy Kubernetes', null, 'IN_PROGRESS')
      insertTask('t2', 'Deploy Kubernetes staging', null, 'DONE')

      const results = await searchTasks('kubernetes', { status: ['IN_PROGRESS'] }, 10)
      expect(results).toHaveLength(1)
      expect(results[0].id).toBe('t1')
    })

    test('returns empty array for no matches', async () => {
      insertTask('t1', 'Fix login bug')
      const results = await searchTasks('kubernetes', {}, 10)
      expect(results).toHaveLength(0)
    })
  })

  describe('searchProjects', () => {
    test('finds projects by name', async () => {
      insertProject('p1', 'Fulcrum Dashboard')
      insertProject('p2', 'API Gateway')

      const results = await searchProjects('fulcrum', {}, 10)
      expect(results).toHaveLength(1)
      expect(results[0].id).toBe('p1')
      expect(results[0].entityType).toBe('project')
    })

    test('filters by status', async () => {
      insertProject('p1', 'Active Project', null, 'active')
      insertProject('p2', 'Archived Project', 'same active content', 'archived')

      const results = await searchProjects('project', { status: 'active' }, 10)
      expect(results).toHaveLength(1)
      expect(results[0].id).toBe('p1')
    })
  })

  describe('searchMemories', () => {
    test('finds memories by content', async () => {
      insertMemory('m1', 'User prefers dark mode for all interfaces')
      insertMemory('m2', 'API timeout is set to 30 seconds')

      const results = await searchMemories('dark mode', {}, 10)
      expect(results).toHaveLength(1)
      expect(results[0].id).toBe('m1')
      expect(results[0].entityType).toBe('memory')
    })
  })

  describe('unified search', () => {
    test('searches across multiple entity types', async () => {
      insertTask('t1', 'Deploy authentication service')
      insertProject('p1', 'Authentication Platform')
      insertMemory('m1', 'The authentication system uses JWT tokens')

      const results = await search({ query: 'authentication' })
      expect(results.length).toBeGreaterThanOrEqual(3)

      const entityTypes = new Set(results.map((r) => r.entityType))
      expect(entityTypes.has('task')).toBe(true)
      expect(entityTypes.has('project')).toBe(true)
      expect(entityTypes.has('memory')).toBe(true)
    })

    test('filters to specific entity types', async () => {
      insertTask('t1', 'Deploy authentication service')
      insertProject('p1', 'Authentication Platform')

      const results = await search({ query: 'authentication', entities: ['tasks'] })
      expect(results).toHaveLength(1)
      expect(results[0].entityType).toBe('task')
    })

    test('respects limit per entity', async () => {
      for (let i = 0; i < 5; i++) {
        insertTask(`t${i}`, `Authentication task ${i}`)
      }

      const results = await search({ query: 'authentication', entities: ['tasks'], limit: 2 })
      expect(results).toHaveLength(2)
    })
  })

  describe('reindexTaskFTS', () => {
    test('reindexes task FTS with current tags', () => {
      insertTask('t1', 'Deploy service')

      // Add a tag via join table
      const now = new Date().toISOString()
      db.run(sql`INSERT INTO tags (id, name, created_at) VALUES ('tag1', 'devops', ${now})`)
      db.run(sql`INSERT INTO task_tags (id, task_id, tag_id, created_at) VALUES ('tt1', 't1', 'tag1', ${now})`)

      // Reindex triggers the UPDATE trigger which rebuilds tags in FTS
      reindexTaskFTS('t1')

      // Now search should find by tag
      const results = db.all(
        sql`SELECT rowid FROM tasks_fts WHERE tasks_fts MATCH 'devops'`
      ) as { rowid: number }[]
      expect(results).toHaveLength(1)
    })
  })
})
