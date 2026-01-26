/**
 * Messaging API routes for WhatsApp and other messaging channels.
 */

import { Hono } from 'hono'
import {
  listConnections,
  getWhatsAppStatus,
  enableWhatsApp,
  disableWhatsApp,
  requestWhatsAppAuth,
  disconnectWhatsApp,
  listSessionMappings,
  getEmailStatus,
  getEmailConfig,
  configureEmail,
  testEmailCredentials,
  disableEmail,
  type EmailAuthState,
} from '../services/messaging'
import { log } from '../lib/logger'

const app = new Hono()

// GET /api/messaging/channels - List all messaging channels
app.get('/channels', (c) => {
  const connections = listConnections()
  return c.json({ channels: connections })
})

// GET /api/messaging/whatsapp - Get WhatsApp connection status
app.get('/whatsapp', (c) => {
  const conn = getWhatsAppStatus()
  return c.json(conn || { enabled: false, status: 'disconnected' })
})

// POST /api/messaging/whatsapp/enable - Enable WhatsApp integration
app.post('/whatsapp/enable', async (c) => {
  try {
    const conn = await enableWhatsApp()
    log.messaging.info('WhatsApp enabled via API')
    return c.json(conn)
  } catch (err) {
    log.messaging.error('Failed to enable WhatsApp', { error: String(err) })
    return c.json({ error: String(err) }, 500)
  }
})

// POST /api/messaging/whatsapp/disable - Disable WhatsApp integration
app.post('/whatsapp/disable', async (c) => {
  try {
    const conn = await disableWhatsApp()
    log.messaging.info('WhatsApp disabled via API')
    return c.json(conn)
  } catch (err) {
    log.messaging.error('Failed to disable WhatsApp', { error: String(err) })
    return c.json({ error: String(err) }, 500)
  }
})

// POST /api/messaging/whatsapp/auth - Request QR code for authentication
app.post('/whatsapp/auth', async (c) => {
  try {
    const result = await requestWhatsAppAuth()
    return c.json(result)
  } catch (err) {
    log.messaging.error('Failed to request WhatsApp auth', { error: String(err) })
    return c.json({ error: String(err) }, 500)
  }
})

// POST /api/messaging/whatsapp/disconnect - Disconnect and clear auth
app.post('/whatsapp/disconnect', async (c) => {
  try {
    const conn = await disconnectWhatsApp()
    log.messaging.info('WhatsApp disconnected via API')
    return c.json(conn)
  } catch (err) {
    log.messaging.error('Failed to disconnect WhatsApp', { error: String(err) })
    return c.json({ error: String(err) }, 500)
  }
})

// GET /api/messaging/whatsapp/sessions - List WhatsApp session mappings
app.get('/whatsapp/sessions', (c) => {
  const conn = getWhatsAppStatus()
  if (!conn) {
    return c.json({ sessions: [] })
  }

  const mappings = listSessionMappings(conn.id)
  return c.json({ sessions: mappings })
})

// ==================== Email Routes ====================

// GET /api/messaging/email - Get email connection status
app.get('/email', (c) => {
  const conn = getEmailStatus()
  const config = getEmailConfig()
  return c.json({
    ...(conn || { enabled: false, status: 'credentials_required' }),
    config,
  })
})

// POST /api/messaging/email/configure - Configure and enable email
app.post('/email/configure', async (c) => {
  try {
    const body = await c.req.json<EmailAuthState>()

    // Validate required fields
    if (!body.smtp?.host || !body.smtp?.user || !body.smtp?.password) {
      return c.json({ error: 'Missing SMTP configuration' }, 400)
    }
    if (!body.imap?.host || !body.imap?.user || !body.imap?.password) {
      return c.json({ error: 'Missing IMAP configuration' }, 400)
    }

    const conn = await configureEmail(body)
    log.messaging.info('Email configured via API')
    return c.json(conn)
  } catch (err) {
    log.messaging.error('Failed to configure email', { error: String(err) })
    return c.json({ error: String(err) }, 500)
  }
})

// POST /api/messaging/email/test - Test email credentials without saving
app.post('/email/test', async (c) => {
  try {
    const body = await c.req.json<EmailAuthState>()

    // Validate required fields
    if (!body.smtp?.host || !body.smtp?.user || !body.smtp?.password) {
      return c.json({ error: 'Missing SMTP configuration' }, 400)
    }
    if (!body.imap?.host || !body.imap?.user || !body.imap?.password) {
      return c.json({ error: 'Missing IMAP configuration' }, 400)
    }

    const result = await testEmailCredentials(body)
    return c.json(result)
  } catch (err) {
    log.messaging.error('Failed to test email credentials', { error: String(err) })
    return c.json({ error: String(err) }, 500)
  }
})

// POST /api/messaging/email/disable - Disable email
app.post('/email/disable', async (c) => {
  try {
    const conn = await disableEmail()
    log.messaging.info('Email disabled via API')
    return c.json(conn)
  } catch (err) {
    log.messaging.error('Failed to disable email', { error: String(err) })
    return c.json({ error: String(err) }, 500)
  }
})

// GET /api/messaging/email/sessions - List email session mappings
app.get('/email/sessions', (c) => {
  const conn = getEmailStatus()
  if (!conn) {
    return c.json({ sessions: [] })
  }

  const mappings = listSessionMappings(conn.id)
  return c.json({ sessions: mappings })
})

export default app
