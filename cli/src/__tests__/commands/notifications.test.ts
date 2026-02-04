import { describe, test, expect, mock, beforeEach, afterEach } from 'bun:test'
import { handleNotificationsCommand } from '../../commands/notifications'
import { CliError, ExitCodes } from '../../utils/errors'

describe('notifications command', () => {
  describe('validation errors', () => {
    test('throws for unknown action', async () => {
      try {
        await handleNotificationsCommand('invalid', [], {})
        expect(true).toBe(false)
      } catch (err) {
        expect(err).toBeInstanceOf(CliError)
        expect((err as CliError).code).toBe('UNKNOWN_ACTION')
        expect((err as CliError).exitCode).toBe(ExitCodes.INVALID_ARGS)
        expect((err as CliError).message).toContain('Unknown action: invalid')
        expect((err as CliError).message).toContain('Valid: status, enable, disable, test, set')
      }
    })

    test('test: throws when channel is missing', async () => {
      try {
        await handleNotificationsCommand('test', [], {})
        expect(true).toBe(false)
      } catch (err) {
        expect(err).toBeInstanceOf(CliError)
        expect((err as CliError).code).toBe('MISSING_CHANNEL')
        expect((err as CliError).message).toContain('Channel is required')
        expect((err as CliError).message).toContain('Valid: sound, slack, discord, pushover')
      }
    })

    test('test: throws for invalid channel', async () => {
      try {
        await handleNotificationsCommand('test', ['invalid'], {})
        expect(true).toBe(false)
      } catch (err) {
        expect(err).toBeInstanceOf(CliError)
        expect((err as CliError).code).toBe('INVALID_CHANNEL')
        expect((err as CliError).message).toContain('Invalid channel: invalid')
      }
    })

    test('set: throws when channel is missing', async () => {
      try {
        await handleNotificationsCommand('set', [], {})
        expect(true).toBe(false)
      } catch (err) {
        expect(err).toBeInstanceOf(CliError)
        expect((err as CliError).code).toBe('MISSING_CHANNEL')
      }
    })

    test('set: throws for invalid channel', async () => {
      try {
        await handleNotificationsCommand('set', ['invalid', 'key', 'value'], {})
        expect(true).toBe(false)
      } catch (err) {
        expect(err).toBeInstanceOf(CliError)
        expect((err as CliError).code).toBe('INVALID_CHANNEL')
      }
    })

    test('set: throws when key is missing', async () => {
      try {
        await handleNotificationsCommand('set', ['slack'], {})
        expect(true).toBe(false)
      } catch (err) {
        expect(err).toBeInstanceOf(CliError)
        expect((err as CliError).code).toBe('MISSING_KEY')
        expect((err as CliError).message).toContain('Setting key is required')
      }
    })

    test('set: throws when value is missing', async () => {
      try {
        await handleNotificationsCommand('set', ['slack', 'webhookUrl'], {})
        expect(true).toBe(false)
      } catch (err) {
        expect(err).toBeInstanceOf(CliError)
        expect((err as CliError).code).toBe('MISSING_VALUE')
        expect((err as CliError).message).toContain('Setting value is required')
      }
    })
  })

  describe('commands that pass validation', () => {
    const originalFetch = global.fetch

    beforeEach(() => {
      // Mock fetch to prevent real HTTP requests to production server
      global.fetch = mock(() =>
        Promise.resolve(new Response(JSON.stringify({ enabled: true }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        }))
      ) as typeof fetch
    })

    afterEach(() => {
      global.fetch = originalFetch
    })

    test('status: passes validation (no action required)', async () => {
      await handleNotificationsCommand(undefined, [], {})
      expect(global.fetch).toHaveBeenCalled()
    })

    test('enable: passes validation (no arguments required)', async () => {
      await handleNotificationsCommand('enable', [], {})
      expect(global.fetch).toHaveBeenCalled()
    })

    test('disable: passes validation (no arguments required)', async () => {
      await handleNotificationsCommand('disable', [], {})
      expect(global.fetch).toHaveBeenCalled()
    })
  })
})
