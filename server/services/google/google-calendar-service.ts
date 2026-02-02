/**
 * Google Calendar Service
 *
 * CRUD for Google accounts and lifecycle management.
 */

import { eq } from 'drizzle-orm'
import { db, googleAccounts, caldavCalendars, caldavEvents } from '../../db'
import type { GoogleAccount } from '../../db'
import { googleCalendarManager } from './google-calendar-manager'
import { createLogger } from '../../lib/logger'

const logger = createLogger('Google:CalendarService')

export function listGoogleAccounts(): GoogleAccount[] {
  return db.select().from(googleAccounts).all()
}

export function getGoogleAccount(id: string): GoogleAccount | undefined {
  return db.select().from(googleAccounts).where(eq(googleAccounts.id, id)).get()
}

export function updateGoogleAccount(
  id: string,
  updates: { name?: string; syncIntervalMinutes?: number; sendAsEmail?: string | null }
): GoogleAccount | undefined {
  const now = new Date().toISOString()
  db.update(googleAccounts)
    .set({ ...updates, updatedAt: now })
    .where(eq(googleAccounts.id, id))
    .run()
  return getGoogleAccount(id)
}

export async function deleteGoogleAccount(id: string): Promise<void> {
  // Stop sync
  googleCalendarManager.stopAccount(id)

  // Delete calendars and events for this account
  const calendars = db
    .select()
    .from(caldavCalendars)
    .where(eq(caldavCalendars.googleAccountId, id))
    .all()

  for (const cal of calendars) {
    db.delete(caldavEvents).where(eq(caldavEvents.calendarId, cal.id)).run()
  }

  db.delete(caldavCalendars).where(eq(caldavCalendars.googleAccountId, id)).run()

  // Delete account
  db.delete(googleAccounts).where(eq(googleAccounts.id, id)).run()

  logger.info('Deleted Google account', { accountId: id })
}

export async function enableGoogleCalendar(id: string): Promise<void> {
  const now = new Date().toISOString()
  db.update(googleAccounts)
    .set({ calendarEnabled: true, updatedAt: now })
    .where(eq(googleAccounts.id, id))
    .run()

  await googleCalendarManager.startAccount(id)
  logger.info('Enabled Google Calendar for account', { accountId: id })
}

export async function disableGoogleCalendar(id: string): Promise<void> {
  const now = new Date().toISOString()
  db.update(googleAccounts)
    .set({ calendarEnabled: false, updatedAt: now })
    .where(eq(googleAccounts.id, id))
    .run()

  googleCalendarManager.stopAccount(id)
  logger.info('Disabled Google Calendar for account', { accountId: id })
}

export async function enableGmail(id: string): Promise<void> {
  const now = new Date().toISOString()
  db.update(googleAccounts)
    .set({ gmailEnabled: true, updatedAt: now })
    .where(eq(googleAccounts.id, id))
    .run()
  logger.info('Enabled Gmail for account', { accountId: id })
}

export async function disableGmail(id: string): Promise<void> {
  const now = new Date().toISOString()
  db.update(googleAccounts)
    .set({ gmailEnabled: false, updatedAt: now })
    .where(eq(googleAccounts.id, id))
    .run()
  logger.info('Disabled Gmail for account', { accountId: id })
}

export async function syncGoogleCalendar(id: string): Promise<void> {
  await googleCalendarManager.syncAccount(id)
}

/**
 * Start Google Calendar sync for all enabled accounts.
 * Called on server startup.
 */
export async function startGoogleCalendarSync(): Promise<void> {
  await googleCalendarManager.startAll()
}

/**
 * Stop all Google Calendar sync.
 * Called on server shutdown.
 */
export function stopGoogleCalendarSync(): void {
  googleCalendarManager.stopAll()
}
