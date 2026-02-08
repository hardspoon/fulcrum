/**
 * Convert a Date object to a YYYY-MM-DD key using local date components.
 * IMPORTANT: Never use date.toISOString().split('T')[0] — that converts to UTC first,
 * causing off-by-one errors in timezones ahead of UTC.
 */
export function localDateToDateKey(date: Date): string {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

/**
 * Parse a YYYY-MM-DD string into a Date at local midnight.
 * Avoids the UTC interpretation that `new Date('2026-02-10')` causes.
 */
export function parseDateKey(dateStr: string): Date {
  const [year, month, day] = dateStr.split('-').map(Number)
  return new Date(year, month - 1, day)
}

/**
 * Format a YYYY-MM-DD date string for display (e.g., "Feb 10, 2026").
 * Parses without UTC conversion to avoid off-by-one errors.
 */
export function formatDateString(
  dateStr: string,
  options: Intl.DateTimeFormatOptions = { month: 'short', day: 'numeric' },
  locale = 'en-US'
): string {
  const date = parseDateKey(dateStr)
  return date.toLocaleDateString(locale, options)
}

/**
 * Get today's date string (YYYY-MM-DD) in the specified timezone.
 * @param timezone - IANA timezone string or null for system timezone
 */
export function getTodayInTimezone(timezone: string | null): string {
  const now = new Date()

  if (!timezone) {
    // Use local system timezone
    const year = now.getFullYear()
    const month = String(now.getMonth() + 1).padStart(2, '0')
    const day = String(now.getDate()).padStart(2, '0')
    return `${year}-${month}-${day}`
  }

  // Use specified timezone - en-CA locale gives YYYY-MM-DD format
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  })
  return formatter.format(now)
}

/**
 * Check if a due date is overdue based on configured timezone.
 * @param dueDate - The due date in YYYY-MM-DD format
 * @param timezone - IANA timezone string or null for system timezone
 * @param status - The task status
 */
export function isDateOverdue(
  dueDate: string | null,
  timezone: string | null,
  status: string
): boolean {
  if (!dueDate) return false
  if (status === 'DONE' || status === 'CANCELED') return false

  const today = getTodayInTimezone(timezone)
  return dueDate < today
}

/**
 * Calculate the next due date based on a recurrence rule.
 * @param currentDueDate - The current due date in YYYY-MM-DD format, or null (uses today)
 * @param rule - The recurrence rule
 * @returns The next due date in YYYY-MM-DD format
 */
export function calculateNextDueDate(
  currentDueDate: string | null,
  rule: 'daily' | 'weekly' | 'biweekly' | 'monthly' | 'quarterly' | 'yearly'
): string {
  const base = currentDueDate
    ? new Date(currentDueDate + 'T00:00:00')
    : new Date()

  switch (rule) {
    case 'daily':
      base.setDate(base.getDate() + 1)
      break
    case 'weekly':
      base.setDate(base.getDate() + 7)
      break
    case 'biweekly':
      base.setDate(base.getDate() + 14)
      break
    case 'monthly':
      base.setMonth(base.getMonth() + 1)
      break
    case 'quarterly':
      base.setMonth(base.getMonth() + 3)
      break
    case 'yearly':
      base.setFullYear(base.getFullYear() + 1)
      break
  }

  const year = base.getFullYear()
  const month = String(base.getMonth() + 1).padStart(2, '0')
  const day = String(base.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

/**
 * Check if a due date is today based on configured timezone.
 * @param dueDate - The due date in YYYY-MM-DD format
 * @param timezone - IANA timezone string or null for system timezone
 * @param status - The task status
 */
export function isDueToday(
  dueDate: string | null,
  timezone: string | null,
  status: string
): boolean {
  if (!dueDate) return false
  if (status === 'DONE' || status === 'CANCELED') return false

  const today = getTodayInTimezone(timezone)
  return dueDate === today
}
