/**
 * Google Account & API Routes
 *
 * CRUD for Google accounts, calendar/gmail enable/disable, manual sync,
 * and Gmail draft management.
 */

import { Hono } from 'hono'
import {
  listGoogleAccounts,
  getGoogleAccount,
  updateGoogleAccount,
  deleteGoogleAccount,
  enableGoogleCalendar,
  disableGoogleCalendar,
  enableGmail,
  disableGmail,
  syncGoogleCalendar,
} from '../services/google/google-calendar-service'
import {
  listDrafts,
  createDraft,
  updateDraft,
  deleteDraft,
  listSendAsAliases,
  sendEmail,
} from '../services/google/gmail-service'
const app = new Hono()

// ==========================================
// Account CRUD
// ==========================================

// GET /api/google/accounts
app.get('/accounts', (c) => {
  const accounts = listGoogleAccounts()
  return c.json({ accounts })
})

// GET /api/google/accounts/:id
app.get('/accounts/:id', (c) => {
  const account = getGoogleAccount(c.req.param('id'))
  if (!account) return c.json({ error: 'Account not found' }, 404)
  return c.json(account)
})

// PATCH /api/google/accounts/:id
app.patch('/accounts/:id', async (c) => {
  const id = c.req.param('id')
  const body = await c.req.json<{ name?: string; syncIntervalMinutes?: number; sendAsEmail?: string | null }>()
  const account = updateGoogleAccount(id, body)
  if (!account) return c.json({ error: 'Account not found' }, 404)
  return c.json(account)
})

// DELETE /api/google/accounts/:id
app.delete('/accounts/:id', async (c) => {
  const id = c.req.param('id')
  try {
    await deleteGoogleAccount(id)
    return c.json({ success: true })
  } catch (err) {
    return c.json({ error: err instanceof Error ? err.message : 'Delete failed' }, 500)
  }
})

// ==========================================
// Calendar enable/disable/sync
// ==========================================

// POST /api/google/accounts/:id/enable-calendar
app.post('/accounts/:id/enable-calendar', async (c) => {
  try {
    await enableGoogleCalendar(c.req.param('id'))
    return c.json({ success: true })
  } catch (err) {
    return c.json({ error: err instanceof Error ? err.message : 'Failed' }, 500)
  }
})

// POST /api/google/accounts/:id/disable-calendar
app.post('/accounts/:id/disable-calendar', async (c) => {
  try {
    await disableGoogleCalendar(c.req.param('id'))
    return c.json({ success: true })
  } catch (err) {
    return c.json({ error: err instanceof Error ? err.message : 'Failed' }, 500)
  }
})

// POST /api/google/accounts/:id/sync
app.post('/accounts/:id/sync', async (c) => {
  try {
    await syncGoogleCalendar(c.req.param('id'))
    return c.json({ success: true })
  } catch (err) {
    return c.json({ error: err instanceof Error ? err.message : 'Sync failed' }, 500)
  }
})

// ==========================================
// Gmail enable/disable
// ==========================================

// POST /api/google/accounts/:id/enable-gmail
app.post('/accounts/:id/enable-gmail', async (c) => {
  try {
    await enableGmail(c.req.param('id'))
    return c.json({ success: true })
  } catch (err) {
    return c.json({ error: err instanceof Error ? err.message : 'Failed' }, 500)
  }
})

// POST /api/google/accounts/:id/disable-gmail
app.post('/accounts/:id/disable-gmail', async (c) => {
  try {
    await disableGmail(c.req.param('id'))
    return c.json({ success: true })
  } catch (err) {
    return c.json({ error: err instanceof Error ? err.message : 'Failed' }, 500)
  }
})

// ==========================================
// Gmail Send-As Aliases
// ==========================================

// GET /api/google/accounts/:id/send-as
app.get('/accounts/:id/send-as', async (c) => {
  try {
    const aliases = await listSendAsAliases(c.req.param('id'))
    return c.json({ aliases })
  } catch (err) {
    return c.json({ error: err instanceof Error ? err.message : 'Failed' }, 500)
  }
})

// ==========================================
// Gmail Send
// ==========================================

// POST /api/google/accounts/:id/send
app.post('/accounts/:id/send', async (c) => {
  try {
    const id = c.req.param('id')
    const account = getGoogleAccount(id)
    if (!account) return c.json({ error: 'Account not found' }, 404)
    if (!account.gmailEnabled) return c.json({ error: 'Gmail not enabled for this account' }, 400)

    const body = await c.req.json<{ subject?: string; body?: string; htmlBody?: string }>()
    const result = await sendEmail(id, body)
    return c.json({ success: true, messageId: result.messageId })
  } catch (err) {
    return c.json({ error: err instanceof Error ? err.message : 'Failed to send email' }, 500)
  }
})

// ==========================================
// Gmail Drafts
// ==========================================

// GET /api/google/accounts/:id/drafts
app.get('/accounts/:id/drafts', async (c) => {
  try {
    const drafts = await listDrafts(c.req.param('id'))
    return c.json({ drafts })
  } catch (err) {
    return c.json({ error: err instanceof Error ? err.message : 'Failed' }, 500)
  }
})

// POST /api/google/accounts/:id/drafts
app.post('/accounts/:id/drafts', async (c) => {
  try {
    const body = await c.req.json<{
      to?: string[]
      cc?: string[]
      bcc?: string[]
      subject?: string
      body?: string
      htmlBody?: string
    }>()
    const draft = await createDraft(c.req.param('id'), body)
    return c.json(draft)
  } catch (err) {
    return c.json({ error: err instanceof Error ? err.message : 'Failed' }, 500)
  }
})

// PATCH /api/google/accounts/:id/drafts/:draftId
app.patch('/accounts/:id/drafts/:draftId', async (c) => {
  try {
    const body = await c.req.json<{
      to?: string[]
      cc?: string[]
      bcc?: string[]
      subject?: string
      body?: string
      htmlBody?: string
    }>()
    const draft = await updateDraft(c.req.param('id'), c.req.param('draftId'), body)
    return c.json(draft)
  } catch (err) {
    return c.json({ error: err instanceof Error ? err.message : 'Failed' }, 500)
  }
})

// DELETE /api/google/accounts/:id/drafts/:draftId
app.delete('/accounts/:id/drafts/:draftId', async (c) => {
  try {
    await deleteDraft(c.req.param('id'), c.req.param('draftId'))
    return c.json({ success: true })
  } catch (err) {
    return c.json({ error: err instanceof Error ? err.message : 'Failed' }, 500)
  }
})

export default app
