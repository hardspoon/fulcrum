import { describe, test, expect } from 'bun:test'
import { expandEnvVar, splitRespectingEnvVars, expandAllEnvVars } from './env-expand'

describe('env-expand', () => {
  describe('expandEnvVar', () => {
    test('returns literal values as-is', () => {
      expect(expandEnvVar('3000')).toBe('3000')
      expect(expandEnvVar('./data')).toBe('./data')
      expect(expandEnvVar('/absolute/path')).toBe('/absolute/path')
    })

    test('expands ${VAR:-default} syntax', () => {
      expect(expandEnvVar('${PORT:-3000}')).toBe('3000')
      expect(expandEnvVar('${DATA_DIR:-./data}')).toBe('./data')
      expect(expandEnvVar('${HOST:-localhost}')).toBe('localhost')
    })

    test('expands ${VAR-default} syntax (without colon)', () => {
      expect(expandEnvVar('${PORT-3000}')).toBe('3000')
      expect(expandEnvVar('${PATH-/usr/bin}')).toBe('/usr/bin')
    })

    test('expands ${VAR:=default} syntax', () => {
      expect(expandEnvVar('${PORT:=8080}')).toBe('8080')
    })

    test('expands ${VAR=default} syntax', () => {
      expect(expandEnvVar('${PORT=8080}')).toBe('8080')
    })

    test('returns null for ${VAR} without default', () => {
      expect(expandEnvVar('${PORT}')).toBeNull()
      expect(expandEnvVar('${UNDEFINED_VAR}')).toBeNull()
    })

    test('returns null for $VAR without default', () => {
      expect(expandEnvVar('$PORT')).toBeNull()
      expect(expandEnvVar('$HOME')).toBeNull()
    })

    test('uses provided env values', () => {
      expect(expandEnvVar('${PORT:-3000}', { PORT: '8080' })).toBe('8080')
      expect(expandEnvVar('${PORT}', { PORT: '8080' })).toBe('8080')
      expect(expandEnvVar('$PORT', { PORT: '8080' })).toBe('8080')
    })

    test('uses default when env value is empty and operator is :-', () => {
      expect(expandEnvVar('${PORT:-3000}', { PORT: '' })).toBe('3000')
    })

    test('uses empty value when env is empty and operator is -', () => {
      expect(expandEnvVar('${PORT-3000}', { PORT: '' })).toBe('')
    })

    test('prefers env value over default', () => {
      expect(expandEnvVar('${PORT:-3000}', { PORT: '9000' })).toBe('9000')
    })
  })

  describe('splitRespectingEnvVars', () => {
    test('splits simple colon-separated values', () => {
      expect(splitRespectingEnvVars('8080:3000')).toEqual(['8080', '3000'])
      expect(splitRespectingEnvVars('a:b:c')).toEqual(['a', 'b', 'c'])
    })

    test('respects ${...} blocks when splitting', () => {
      expect(splitRespectingEnvVars('${PORT:-8080}:${PORT:-8080}')).toEqual([
        '${PORT:-8080}',
        '${PORT:-8080}',
      ])
    })

    test('handles mixed literal and env var values', () => {
      expect(splitRespectingEnvVars('8080:${PORT:-3000}')).toEqual(['8080', '${PORT:-3000}'])
      expect(splitRespectingEnvVars('${HOST:-0.0.0.0}:8080:3000')).toEqual([
        '${HOST:-0.0.0.0}',
        '8080',
        '3000',
      ])
    })

    test('handles IP:host:container format with env vars', () => {
      expect(splitRespectingEnvVars('127.0.0.1:${PORT:-8080}:${PORT:-8080}')).toEqual([
        '127.0.0.1',
        '${PORT:-8080}',
        '${PORT:-8080}',
      ])
    })

    test('handles volume paths with env vars', () => {
      expect(splitRespectingEnvVars('${DATA_DIR:-./data}:/app/data')).toEqual([
        '${DATA_DIR:-./data}',
        '/app/data',
      ])
      expect(splitRespectingEnvVars('${DATA_DIR:-./data}:/app/data:ro')).toEqual([
        '${DATA_DIR:-./data}',
        '/app/data',
        'ro',
      ])
    })

    test('handles nested colons in defaults', () => {
      // This is an edge case - a default value containing a colon
      expect(splitRespectingEnvVars('${URL:-http://localhost:3000}:80')).toEqual([
        '${URL:-http://localhost:3000}',
        '80',
      ])
    })

    test('returns single element for no delimiter', () => {
      expect(splitRespectingEnvVars('3000')).toEqual(['3000'])
      expect(splitRespectingEnvVars('${PORT:-3000}')).toEqual(['${PORT:-3000}'])
    })
  })

  describe('expandAllEnvVars', () => {
    test('expands multiple env vars in a string', () => {
      expect(expandAllEnvVars('http://${HOST:-localhost}:${PORT:-3000}')).toBe(
        'http://localhost:3000'
      )
    })

    test('returns null if any var is unresolvable', () => {
      expect(expandAllEnvVars('http://${HOST}:${PORT:-3000}')).toBeNull()
    })

    test('uses provided env values', () => {
      expect(
        expandAllEnvVars('http://${HOST:-localhost}:${PORT:-3000}', {
          HOST: 'example.com',
          PORT: '8080',
        })
      ).toBe('http://example.com:8080')
    })

    test('handles strings with no env vars', () => {
      expect(expandAllEnvVars('http://localhost:3000')).toBe('http://localhost:3000')
    })

    test('handles $VAR syntax', () => {
      expect(expandAllEnvVars('$HOME/data', { HOME: '/home/user' })).toBe('/home/user/data')
    })
  })
})
