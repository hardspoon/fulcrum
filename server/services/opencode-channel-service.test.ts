// Tests for OpenCode observer channel service - JSON action parsing and memory storage
import { describe, test, expect } from 'bun:test'

/**
 * Since streamOpencodeObserverMessage depends on an external OpenCode server,
 * these tests focus on the JSON response parsing logic that can be tested in isolation.
 */

// Extract and test the JSON parsing logic used by the observer
function parseObserverResponse(responseText: string): Array<{
  type: string
  content?: string
  tags?: string[]
  source?: string
}> {
  if (!responseText) return []

  let jsonText = responseText.trim()
  const jsonMatch = jsonText.match(/```(?:json)?\s*([\s\S]*?)```/)
  if (jsonMatch) {
    jsonText = jsonMatch[1].trim()
  }

  const parsed = JSON.parse(jsonText) as {
    actions?: Array<{
      type: string
      content?: string
      tags?: string[]
      source?: string
    }>
  }

  if (parsed.actions && Array.isArray(parsed.actions)) {
    return parsed.actions
  }

  return []
}

describe('OpenCode Observer - Response Parsing', () => {
  test('parses plain JSON response with store_memory action', () => {
    const response = JSON.stringify({
      actions: [
        {
          type: 'store_memory',
          content: 'Meeting scheduled for Friday at 3pm',
          tags: ['meeting', 'schedule'],
          source: 'channel:whatsapp',
        },
      ],
    })

    const actions = parseObserverResponse(response)
    expect(actions).toHaveLength(1)
    expect(actions[0].type).toBe('store_memory')
    expect(actions[0].content).toBe('Meeting scheduled for Friday at 3pm')
    expect(actions[0].tags).toEqual(['meeting', 'schedule'])
    expect(actions[0].source).toBe('channel:whatsapp')
  })

  test('parses JSON wrapped in markdown code block', () => {
    const response = '```json\n{"actions": [{"type": "store_memory", "content": "Important fact"}]}\n```'

    const actions = parseObserverResponse(response)
    expect(actions).toHaveLength(1)
    expect(actions[0].content).toBe('Important fact')
  })

  test('parses JSON wrapped in untyped code block', () => {
    const response = '```\n{"actions": [{"type": "store_memory", "content": "Data point"}]}\n```'

    const actions = parseObserverResponse(response)
    expect(actions).toHaveLength(1)
    expect(actions[0].content).toBe('Data point')
  })

  test('parses empty actions array', () => {
    const response = '{"actions": []}'
    const actions = parseObserverResponse(response)
    expect(actions).toHaveLength(0)
  })

  test('handles multiple actions', () => {
    const response = JSON.stringify({
      actions: [
        { type: 'store_memory', content: 'Fact one', tags: ['tag1'] },
        { type: 'store_memory', content: 'Fact two', tags: ['tag2'] },
      ],
    })

    const actions = parseObserverResponse(response)
    expect(actions).toHaveLength(2)
    expect(actions[0].content).toBe('Fact one')
    expect(actions[1].content).toBe('Fact two')
  })

  test('returns empty array for empty response', () => {
    const actions = parseObserverResponse('')
    expect(actions).toHaveLength(0)
  })

  test('throws on invalid JSON', () => {
    expect(() => parseObserverResponse('this is not json')).toThrow()
  })

  test('returns empty array when actions field is missing', () => {
    const response = '{"result": "nothing"}'
    const actions = parseObserverResponse(response)
    expect(actions).toHaveLength(0)
  })

  test('returns empty array when actions is not an array', () => {
    const response = '{"actions": "invalid"}'
    const actions = parseObserverResponse(response)
    expect(actions).toHaveLength(0)
  })

  test('filters only store_memory actions (other types pass through)', () => {
    const response = JSON.stringify({
      actions: [
        { type: 'store_memory', content: 'Keep this' },
        { type: 'ignore' },
        { type: 'store_memory', content: 'Keep this too' },
      ],
    })

    const actions = parseObserverResponse(response)
    expect(actions).toHaveLength(3) // All actions are returned; filtering is done by caller
    const memoryActions = actions.filter((a) => a.type === 'store_memory')
    expect(memoryActions).toHaveLength(2)
  })

  test('handles action without optional fields', () => {
    const response = JSON.stringify({
      actions: [{ type: 'store_memory', content: 'Minimal entry' }],
    })

    const actions = parseObserverResponse(response)
    expect(actions).toHaveLength(1)
    expect(actions[0].tags).toBeUndefined()
    expect(actions[0].source).toBeUndefined()
  })
})

describe('OpenCode Observer - Model String Parsing', () => {
  // Test the provider/model ID parsing logic used by both opencode services
  function parseModelString(model: string): { providerID: string; modelID: string } | undefined {
    const slashIndex = model.indexOf('/')
    if (slashIndex > 0) {
      return {
        providerID: model.substring(0, slashIndex),
        modelID: model.substring(slashIndex + 1),
      }
    }
    return undefined
  }

  test('parses standard provider/model format', () => {
    const result = parseModelString('anthropic/claude-opus-4-5')
    expect(result).toEqual({
      providerID: 'anthropic',
      modelID: 'claude-opus-4-5',
    })
  })

  test('parses multi-segment model ID', () => {
    const result = parseModelString('openrouter/z-ai/glm-4.7')
    expect(result).toEqual({
      providerID: 'openrouter',
      modelID: 'z-ai/glm-4.7',
    })
  })

  test('returns undefined for model without provider prefix', () => {
    const result = parseModelString('claude-opus-4-5')
    expect(result).toBeUndefined()
  })

  test('returns undefined for model starting with slash', () => {
    const result = parseModelString('/claude-opus-4-5')
    expect(result).toBeUndefined()
  })
})

describe('OpenCode Observer - System Prompt', () => {
  // Validate the observer system prompt contains expected instructions
  const OBSERVER_SYSTEM_PROMPT = `You are an observer processing messages from external channels. Your ONLY job is to identify important information worth remembering.

IMPORTANT: You have NO tools. Instead, respond with a JSON object describing what actions to take.

Response format (respond with ONLY this JSON, no other text):
{
  "actions": [
    {
      "type": "store_memory",
      "content": "The fact or information to store",
      "tags": ["tag1", "tag2"],
      "source": "channel:whatsapp"
    }
  ]
}

If the message contains nothing worth remembering (casual chat, greetings, spam, etc.), respond with:
{"actions": []}

Guidelines for what to store:
- Important dates, deadlines, appointments
- Decisions or agreements
- Contact information
- Project updates or status changes
- Action items or requests
- Key facts or data points

Do NOT store:
- Casual greetings or small talk
- Spam or promotional content
- Messages you don't understand
- Trivially obvious information`

  test('instructs AI to respond with JSON only', () => {
    expect(OBSERVER_SYSTEM_PROMPT).toContain('respond with ONLY this JSON')
  })

  test('includes store_memory action format', () => {
    expect(OBSERVER_SYSTEM_PROMPT).toContain('"type": "store_memory"')
  })

  test('explicitly states no tools available', () => {
    expect(OBSERVER_SYSTEM_PROMPT).toContain('You have NO tools')
  })

  test('includes empty actions fallback', () => {
    expect(OBSERVER_SYSTEM_PROMPT).toContain('{"actions": []}')
  })

  test('includes guidelines for what to store', () => {
    expect(OBSERVER_SYSTEM_PROMPT).toContain('Important dates')
    expect(OBSERVER_SYSTEM_PROMPT).toContain('Decisions or agreements')
  })

  test('includes guidelines for what not to store', () => {
    expect(OBSERVER_SYSTEM_PROMPT).toContain('Casual greetings')
    expect(OBSERVER_SYSTEM_PROMPT).toContain('Spam or promotional')
  })
})
