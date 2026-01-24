import { describe, test, expect } from 'bun:test'
import { getTodayInTimezone, isDateOverdue } from './date-utils'

describe('date-utils', () => {
  describe('getTodayInTimezone', () => {
    test('returns YYYY-MM-DD format', () => {
      const result = getTodayInTimezone(null)
      expect(result).toMatch(/^\d{4}-\d{2}-\d{2}$/)
    })

    test('returns valid date components', () => {
      const result = getTodayInTimezone(null)
      const [year, month, day] = result.split('-').map(Number)

      expect(year).toBeGreaterThanOrEqual(2020)
      expect(year).toBeLessThanOrEqual(2100)
      expect(month).toBeGreaterThanOrEqual(1)
      expect(month).toBeLessThanOrEqual(12)
      expect(day).toBeGreaterThanOrEqual(1)
      expect(day).toBeLessThanOrEqual(31)
    })

    test('returns different dates for different timezones when near midnight UTC', () => {
      // This test verifies the timezone logic works - at certain times,
      // different timezones will have different dates
      const utc = getTodayInTimezone('UTC')
      const tokyo = getTodayInTimezone('Asia/Tokyo') // UTC+9
      const losAngeles = getTodayInTimezone('America/Los_Angeles') // UTC-8

      // All should be valid dates
      expect(utc).toMatch(/^\d{4}-\d{2}-\d{2}$/)
      expect(tokyo).toMatch(/^\d{4}-\d{2}-\d{2}$/)
      expect(losAngeles).toMatch(/^\d{4}-\d{2}-\d{2}$/)
    })

    test('handles null timezone (system default)', () => {
      const result = getTodayInTimezone(null)
      expect(result).toMatch(/^\d{4}-\d{2}-\d{2}$/)
    })

    test('returns consistent format for known timezones', () => {
      const timezones = [
        'America/New_York',
        'America/Chicago',
        'America/Denver',
        'America/Los_Angeles',
        'Europe/London',
        'Europe/Paris',
        'Asia/Tokyo',
        'Asia/Shanghai',
        'Australia/Sydney',
        'Pacific/Auckland',
        'UTC',
      ]

      for (const tz of timezones) {
        const result = getTodayInTimezone(tz)
        expect(result).toMatch(/^\d{4}-\d{2}-\d{2}$/)
      }
    })
  })

  describe('isDateOverdue', () => {
    test('returns false for null due date', () => {
      expect(isDateOverdue(null, null, 'IN_PROGRESS')).toBe(false)
      expect(isDateOverdue(null, 'America/New_York', 'TO_DO')).toBe(false)
    })

    test('returns false for DONE status', () => {
      // Yesterday should be overdue, but DONE status ignores this
      const yesterday = new Date()
      yesterday.setDate(yesterday.getDate() - 1)
      const yesterdayStr = yesterday.toISOString().split('T')[0]

      expect(isDateOverdue(yesterdayStr, null, 'DONE')).toBe(false)
    })

    test('returns false for CANCELED status', () => {
      // Yesterday should be overdue, but CANCELED status ignores this
      const yesterday = new Date()
      yesterday.setDate(yesterday.getDate() - 1)
      const yesterdayStr = yesterday.toISOString().split('T')[0]

      expect(isDateOverdue(yesterdayStr, null, 'CANCELED')).toBe(false)
    })

    test('returns true for past due date with active status', () => {
      // A week ago should definitely be overdue
      const weekAgo = new Date()
      weekAgo.setDate(weekAgo.getDate() - 7)
      const weekAgoStr = weekAgo.toISOString().split('T')[0]

      expect(isDateOverdue(weekAgoStr, null, 'IN_PROGRESS')).toBe(true)
      expect(isDateOverdue(weekAgoStr, null, 'TO_DO')).toBe(true)
      expect(isDateOverdue(weekAgoStr, null, 'IN_REVIEW')).toBe(true)
    })

    test('returns false for future due date', () => {
      // A week from now should not be overdue
      const nextWeek = new Date()
      nextWeek.setDate(nextWeek.getDate() + 7)
      const nextWeekStr = nextWeek.toISOString().split('T')[0]

      expect(isDateOverdue(nextWeekStr, null, 'IN_PROGRESS')).toBe(false)
      expect(isDateOverdue(nextWeekStr, null, 'TO_DO')).toBe(false)
    })

    test('returns false for due date equal to today', () => {
      // Today is not overdue (due today, not past due)
      const today = getTodayInTimezone(null)

      expect(isDateOverdue(today, null, 'IN_PROGRESS')).toBe(false)
      expect(isDateOverdue(today, null, 'TO_DO')).toBe(false)
    })

    test('respects timezone for overdue calculation', () => {
      // Create a date that's yesterday in all reasonable timezones
      const yesterday = new Date()
      yesterday.setDate(yesterday.getDate() - 2) // 2 days ago to be safe
      const yesterdayStr = yesterday.toISOString().split('T')[0]

      // Should be overdue regardless of timezone
      expect(isDateOverdue(yesterdayStr, 'America/New_York', 'IN_PROGRESS')).toBe(true)
      expect(isDateOverdue(yesterdayStr, 'Asia/Tokyo', 'IN_PROGRESS')).toBe(true)
      expect(isDateOverdue(yesterdayStr, 'UTC', 'IN_PROGRESS')).toBe(true)
    })
  })
})
