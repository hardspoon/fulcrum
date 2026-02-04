import { describe, test, expect, mock, beforeEach, afterEach } from 'bun:test'
import { handleNotifyCommand } from '../../commands/notify'
import { CliError, ExitCodes } from '../../utils/errors'

describe('notify command', () => {
  describe('validation errors', () => {
    test('throws when title is missing', async () => {
      try {
        await handleNotifyCommand([], {})
        expect(true).toBe(false)
      } catch (err) {
        expect(err).toBeInstanceOf(CliError)
        expect((err as CliError).code).toBe('MISSING_TITLE')
        expect((err as CliError).exitCode).toBe(ExitCodes.INVALID_ARGS)
        expect((err as CliError).message).toContain('Title is required')
      }
    })
  })

  describe('commands that pass validation', () => {
    const originalFetch = global.fetch

    beforeEach(() => {
      // Mock fetch to prevent real HTTP requests to production server
      global.fetch = mock(() =>
        Promise.resolve(new Response(JSON.stringify({ results: [{ success: true }] }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        }))
      ) as typeof fetch
    })

    afterEach(() => {
      global.fetch = originalFetch
    })

    test('accepts title from positional argument', async () => {
      await handleNotifyCommand(['Test Title'], {})
      expect(global.fetch).toHaveBeenCalled()
    })

    test('accepts title from --title flag', async () => {
      await handleNotifyCommand([], { title: 'Test Title' })
      expect(global.fetch).toHaveBeenCalled()
    })

    test('accepts title and message from positional arguments', async () => {
      await handleNotifyCommand(['Test Title', 'with', 'message'], {})
      expect(global.fetch).toHaveBeenCalled()
    })

    test('accepts title and message from flags', async () => {
      await handleNotifyCommand([], { title: 'Title', message: 'Message' })
      expect(global.fetch).toHaveBeenCalled()
    })
  })
})
