/**
 * Concierge API routes for actionable events, sweep runs, and message sending.
 */

import { Hono } from 'hono'
import { nanoid } from 'nanoid'
import { eq, desc, and, sql } from 'drizzle-orm'
import { db, actionableEvents, sweepRuns, tasks } from '../db'
import type { ActionableEvent, NewActionableEvent } from '../db/schema'
import { log } from '../lib/logger'
import { sendMessageToChannel } from '../services/concierge-scheduler'

const app = new Hono()

// ==================== Actionable Events ====================

// GET /api/concierge/events - List actionable events
app.get('/events', (c) => {
  try {
    const status = c.req.query('status')
    const channel = c.req.query('channel')
    const limit = parseInt(c.req.query('limit') || '50')
    const offset = parseInt(c.req.query('offset') || '0')

    const conditions = []
    if (status) {
      conditions.push(eq(actionableEvents.status, status))
    }
    if (channel) {
      conditions.push(eq(actionableEvents.sourceChannel, channel))
    }

    const whereClause = conditions.length > 0 ? and(...conditions) : undefined

    const events = db
      .select()
      .from(actionableEvents)
      .where(whereClause)
      .orderBy(desc(actionableEvents.createdAt))
      .limit(limit)
      .offset(offset)
      .all()

    const totalResult = db
      .select({ count: sql<number>`count(*)` })
      .from(actionableEvents)
      .where(whereClause)
      .get()

    return c.json({
      events,
      total: totalResult?.count ?? 0,
    })
  } catch (err) {
    log.concierge.error('Failed to list actionable events', { error: String(err) })
    return c.json({ error: String(err) }, 500)
  }
})

// GET /api/concierge/events/:id - Get a specific event
app.get('/events/:id', (c) => {
  try {
    const id = c.req.param('id')
    const event = db
      .select()
      .from(actionableEvents)
      .where(eq(actionableEvents.id, id))
      .get()

    if (!event) {
      return c.json({ error: 'Event not found' }, 404)
    }

    // If linked to a task, include task details
    let linkedTask = null
    if (event.linkedTaskId) {
      linkedTask = db
        .select()
        .from(tasks)
        .where(eq(tasks.id, event.linkedTaskId))
        .get()
    }

    return c.json({ ...event, linkedTask })
  } catch (err) {
    log.concierge.error('Failed to get actionable event', { error: String(err) })
    return c.json({ error: String(err) }, 500)
  }
})

// POST /api/concierge/events - Create an actionable event
app.post('/events', async (c) => {
  try {
    const body = await c.req.json<{
      sourceChannel: string
      sourceId: string
      sourceMetadata?: Record<string, unknown>
      summary?: string
      status?: 'pending' | 'acted_upon' | 'dismissed' | 'monitoring'
      linkedTaskId?: string
    }>()

    if (!body.sourceChannel || !body.sourceId) {
      return c.json({ error: 'sourceChannel and sourceId are required' }, 400)
    }

    const id = nanoid()
    const now = new Date().toISOString()

    const newEvent: NewActionableEvent = {
      id,
      sourceChannel: body.sourceChannel,
      sourceId: body.sourceId,
      sourceMetadata: body.sourceMetadata,
      summary: body.summary,
      status: body.status || 'pending',
      linkedTaskId: body.linkedTaskId,
      actionLog: [{ timestamp: now, action: 'Event created' }],
      createdAt: now,
      updatedAt: now,
    }

    db.insert(actionableEvents).values(newEvent).run()

    log.concierge.info('Created actionable event', {
      eventId: id,
      sourceChannel: body.sourceChannel,
    })

    return c.json(
      db.select().from(actionableEvents).where(eq(actionableEvents.id, id)).get()
    )
  } catch (err) {
    log.concierge.error('Failed to create actionable event', { error: String(err) })
    return c.json({ error: String(err) }, 500)
  }
})

// PATCH /api/concierge/events/:id - Update an actionable event
app.patch('/events/:id', async (c) => {
  try {
    const id = c.req.param('id')
    const body = await c.req.json<{
      status?: 'pending' | 'acted_upon' | 'dismissed' | 'monitoring'
      linkedTaskId?: string | null
      actionLogEntry?: string
    }>()

    const event = db
      .select()
      .from(actionableEvents)
      .where(eq(actionableEvents.id, id))
      .get()

    if (!event) {
      return c.json({ error: 'Event not found' }, 404)
    }

    const now = new Date().toISOString()
    const updates: Partial<ActionableEvent> = {
      updatedAt: now,
      lastEvaluatedAt: now,
    }

    if (body.status !== undefined) {
      updates.status = body.status
    }

    if (body.linkedTaskId !== undefined) {
      updates.linkedTaskId = body.linkedTaskId
    }

    // Append to action log if provided
    if (body.actionLogEntry) {
      const currentLog = event.actionLog || []
      updates.actionLog = [...currentLog, { timestamp: now, action: body.actionLogEntry }]
    }

    db.update(actionableEvents)
      .set(updates)
      .where(eq(actionableEvents.id, id))
      .run()

    log.concierge.info('Updated actionable event', { eventId: id, updates: Object.keys(body) })

    return c.json(
      db.select().from(actionableEvents).where(eq(actionableEvents.id, id)).get()
    )
  } catch (err) {
    log.concierge.error('Failed to update actionable event', { error: String(err) })
    return c.json({ error: String(err) }, 500)
  }
})

// DELETE /api/concierge/events/:id - Delete an actionable event
app.delete('/events/:id', (c) => {
  try {
    const id = c.req.param('id')
    const event = db
      .select()
      .from(actionableEvents)
      .where(eq(actionableEvents.id, id))
      .get()

    if (!event) {
      return c.json({ error: 'Event not found' }, 404)
    }

    db.delete(actionableEvents).where(eq(actionableEvents.id, id)).run()

    log.concierge.info('Deleted actionable event', { eventId: id })

    return c.json({ success: true })
  } catch (err) {
    log.concierge.error('Failed to delete actionable event', { error: String(err) })
    return c.json({ error: String(err) }, 500)
  }
})

// ==================== Sweep Runs ====================

// GET /api/concierge/sweeps - List sweep runs
app.get('/sweeps', (c) => {
  try {
    const type = c.req.query('type')
    const limit = parseInt(c.req.query('limit') || '50')

    const conditions = []
    if (type) {
      conditions.push(eq(sweepRuns.type, type))
    }

    const whereClause = conditions.length > 0 ? and(...conditions) : undefined

    const runs = db
      .select()
      .from(sweepRuns)
      .where(whereClause)
      .orderBy(desc(sweepRuns.startedAt))
      .limit(limit)
      .all()

    return c.json({ runs })
  } catch (err) {
    log.concierge.error('Failed to list sweep runs', { error: String(err) })
    return c.json({ error: String(err) }, 500)
  }
})

// GET /api/concierge/sweeps/:id - Get a specific sweep run
app.get('/sweeps/:id', (c) => {
  try {
    const id = c.req.param('id')
    const run = db
      .select()
      .from(sweepRuns)
      .where(eq(sweepRuns.id, id))
      .get()

    if (!run) {
      return c.json({ error: 'Sweep run not found' }, 404)
    }

    return c.json(run)
  } catch (err) {
    log.concierge.error('Failed to get sweep run', { error: String(err) })
    return c.json({ error: String(err) }, 500)
  }
})

// GET /api/concierge/sweeps/last/:type - Get the last sweep run of a type
app.get('/sweeps/last/:type', (c) => {
  try {
    const type = c.req.param('type')
    const run = db
      .select()
      .from(sweepRuns)
      .where(eq(sweepRuns.type, type))
      .orderBy(desc(sweepRuns.startedAt))
      .limit(1)
      .get()

    return c.json(run || null)
  } catch (err) {
    log.concierge.error('Failed to get last sweep run', { error: String(err) })
    return c.json({ error: String(err) }, 500)
  }
})

// ==================== Message Sending ====================

// POST /api/concierge/message - Send a message to a channel
app.post('/message', async (c) => {
  try {
    const body = await c.req.json<{
      channel: 'email' | 'whatsapp' | 'telegram' | 'slack' | 'all'
      to: string
      body: string
      subject?: string
      replyToMessageId?: string
    }>()

    if (!body.channel || !body.to || !body.body) {
      return c.json({ error: 'channel, to, and body are required' }, 400)
    }

    const result = await sendMessageToChannel(
      body.channel,
      body.to,
      body.body,
      {
        subject: body.subject,
        replyToMessageId: body.replyToMessageId,
      }
    )

    return c.json(result)
  } catch (err) {
    log.concierge.error('Failed to send message', { error: String(err) })
    return c.json({ error: String(err) }, 500)
  }
})

// ==================== Stats ====================

// GET /api/concierge/stats - Get concierge statistics
app.get('/stats', (c) => {
  try {
    // Count events by status
    const pendingCount = db
      .select({ count: sql<number>`count(*)` })
      .from(actionableEvents)
      .where(eq(actionableEvents.status, 'pending'))
      .get()?.count ?? 0

    const actedUponCount = db
      .select({ count: sql<number>`count(*)` })
      .from(actionableEvents)
      .where(eq(actionableEvents.status, 'acted_upon'))
      .get()?.count ?? 0

    const dismissedCount = db
      .select({ count: sql<number>`count(*)` })
      .from(actionableEvents)
      .where(eq(actionableEvents.status, 'dismissed'))
      .get()?.count ?? 0

    const monitoringCount = db
      .select({ count: sql<number>`count(*)` })
      .from(actionableEvents)
      .where(eq(actionableEvents.status, 'monitoring'))
      .get()?.count ?? 0

    // Get last sweep times
    const lastHourlySweep = db
      .select()
      .from(sweepRuns)
      .where(eq(sweepRuns.type, 'hourly'))
      .orderBy(desc(sweepRuns.startedAt))
      .limit(1)
      .get()

    const lastMorningRitual = db
      .select()
      .from(sweepRuns)
      .where(eq(sweepRuns.type, 'morning_ritual'))
      .orderBy(desc(sweepRuns.startedAt))
      .limit(1)
      .get()

    const lastEveningRitual = db
      .select()
      .from(sweepRuns)
      .where(eq(sweepRuns.type, 'evening_ritual'))
      .orderBy(desc(sweepRuns.startedAt))
      .limit(1)
      .get()

    return c.json({
      events: {
        pending: pendingCount,
        actedUpon: actedUponCount,
        dismissed: dismissedCount,
        monitoring: monitoringCount,
        total: pendingCount + actedUponCount + dismissedCount + monitoringCount,
      },
      lastSweeps: {
        hourly: lastHourlySweep?.completedAt,
        morningRitual: lastMorningRitual?.completedAt,
        eveningRitual: lastEveningRitual?.completedAt,
      },
    })
  } catch (err) {
    log.concierge.error('Failed to get concierge stats', { error: String(err) })
    return c.json({ error: String(err) }, 500)
  }
})

export default app
