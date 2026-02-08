/**
 * OpenCode observer service for processing observe-only channel messages.
 *
 * Uses text-only processing with Fulcrum-mediated actions:
 * 1. Sends the message to OpenCode as plain text with structured output instructions
 * 2. Parses the JSON response for actions (store_memory, ignore)
 * 3. Fulcrum executes the actions — the AI never directly invokes tools
 *
 * This ensures untrusted channel input cannot access filesystem, exec, or deploy tools.
 */
import { createOpencode, createOpencodeClient, type OpencodeClient } from '@opencode-ai/sdk'
import { log } from '../lib/logger'
import { getSettings } from '../lib/settings'
import { storeMemory } from './memory-service'

// Default OpenCode server port
const OPENCODE_DEFAULT_PORT = 4096

// OpenCode client singleton (shared with opencode-chat-service)
let opencodeClient: OpencodeClient | null = null

async function getClient(): Promise<OpencodeClient> {
  if (opencodeClient) return opencodeClient

  try {
    const client = createOpencodeClient({ baseUrl: `http://localhost:${OPENCODE_DEFAULT_PORT}` })
    await client.session.list()
    opencodeClient = client
    return opencodeClient
  } catch {
    // Not running, start one
  }

  log.messaging.info('Starting OpenCode server for observer', { port: OPENCODE_DEFAULT_PORT })
  const result = await createOpencode({ port: OPENCODE_DEFAULT_PORT })
  opencodeClient = result.client
  log.messaging.info('OpenCode server started for observer', { url: result.server.url })
  return opencodeClient
}

const OBSERVER_SYSTEM_PROMPT = `You are the user's observer. Only create a task when the user must take a specific action or fulfill a commitment they might otherwise forget. Default to storing a memory or doing nothing — only escalate to a task when doing nothing would cause the user to miss something important. A frivolous task is worse than no task: it wastes the user's time and erodes trust.

IMPORTANT: You have NO tools. Instead, respond with a JSON object describing what actions to take.

Response format (respond with ONLY this JSON, no other text):
{
  "actions": [
    {
      "type": "create_task",
      "title": "Clear action item title",
      "description": "Details including sender and context",
      "tags": ["from:whatsapp", "errand"],
      "dueDate": "2025-02-18"
    },
    {
      "type": "store_memory",
      "content": "The fact or information to store",
      "tags": ["persistent"],
      "source": "channel:whatsapp"
    }
  ]
}

If the message contains nothing worth tracking (casual chat, greetings, spam, etc.), respond with:
{"actions": []}

## Action types

### create_task (only for genuine action items)
Use for: someone specifically asks the user to do something, the user must fulfill a commitment, a genuine deadline the user must meet.
Do NOT use for: automated notifications, FYI messages, event reminders, status updates, confirmations.
Fields: title (required, imperative action item), description, tags (array), dueDate (YYYY-MM-DD if mentioned).
Write titles as clear action items (e.g., "Send invoice to Alice" not "Email from Alice about invoice").

### store_memory (for non-task observations)
Use for: learning someone's name, recurring patterns, key relationships, context updates, noteworthy information from notifications.
Fields: content (required), tags (array), source (e.g., "channel:whatsapp").

## Guidelines

Create a task ONLY when:
- Someone specifically asks the user to do something ("Can you send me X?", "Please review Y")
- The user made a commitment they might forget (promised to call someone, agreed to deliver something)
- A genuine deadline the user must personally meet (tax filing, contract deadline)

Store a memory for:
- Contact details, names, relationships
- Project context or status updates
- Patterns worth remembering
- Noteworthy information from notifications (without creating a task)

Do nothing for:
- Automated notifications (shipping updates, RSVP alerts, CI/CD results, social media)
- FYI/informational messages that don't require user action
- Event reminders for events already on the calendar
- Status updates and confirmations (order confirmations, booking confirmations)
- Newsletters, promotional emails, marketing content
- Casual greetings or small talk
- Messages you don't understand

## Examples

CREATE a task:
- WhatsApp: "Can you send me that document?" → title: "Send document to Alice"
- Email: "Can you confirm the budget for the project?" → title: "Reply to Bob with project budget details"
- Email: "Here's the proposal, let me know your thoughts" → title: "Review and respond to proposal from Carol"
- WhatsApp: "Let's schedule a call next week" → title: "Schedule call with Dave"

Do NOT create a task:
- Meetup RSVP notification: "3 new RSVPs for your event" → do nothing (automated FYI)
- Shipping update: "Your package is out for delivery" → do nothing (automated FYI)
- Order confirmation: "Your order #1234 has been confirmed" → do nothing (automated FYI)
- Newsletter or marketing email → do nothing

## Decision test
Before creating a task, ask: "Is the user being asked to DO something specific, or would they miss a commitment without this?" If no, do nothing.`

/**
 * Process an observe-only channel message via OpenCode without direct tool access.
 */
export async function* streamOpencodeObserverMessage(
  sessionId: string,
  userMessage: string,
  options: {
    channelType: string
    senderId: string
    senderName?: string
    model?: string
  }
): AsyncGenerator<{ type: string; data: unknown }> {
  try {
    const client = await getClient()
    const settings = getSettings()

    // Determine model: observer-specific or fall back to global opencode model
    const model = options.model || settings.assistant.observerOpencodeModel || settings.agent.opencodeModel

    // Build the prompt with context
    const contextualMessage = `[${options.channelType.toUpperCase()} message from ${options.senderName || options.senderId}]

${userMessage}`

    const fullPrompt = `${OBSERVER_SYSTEM_PROMPT}

---

${contextualMessage}`

    // Create a session for this observer request
    let modelConfig: { providerID: string; modelID: string } | undefined
    if (model) {
      const slashIndex = model.indexOf('/')
      if (slashIndex > 0) {
        modelConfig = {
          providerID: model.substring(0, slashIndex),
          modelID: model.substring(slashIndex + 1),
        }
      }
    }

    const newSession = await client.session.create({
      body: {
        ...(modelConfig && { model: modelConfig }),
      },
    })

    if (newSession.error) {
      throw new Error(newSession.error.message || 'Failed to create OpenCode observer session')
    }

    const opencodeSessionId = newSession.data?.id
    if (!opencodeSessionId) {
      throw new Error('Failed to get OpenCode session ID')
    }

    // Subscribe to events before sending the prompt
    const eventResult = await client.event.subscribe()

    // Send the prompt
    const promptPromise = client.session.prompt({
      path: { id: opencodeSessionId },
      body: {
        parts: [{ type: 'text', text: fullPrompt }],
        ...(modelConfig && { model: modelConfig }),
      },
    })

    // Collect response
    let responseText = ''
    const timeout = 60000 // 1 minute timeout for observer
    const startTime = Date.now()
    const partTextCache = new Map<string, string>()
    let userMessageId: string | null = null

    for await (const event of eventResult.stream) {
      if (Date.now() - startTime > timeout) {
        log.messaging.warn('OpenCode observer timeout', { sessionId })
        break
      }

      const evt = event as {
        type?: string
        properties?: {
          part?: { type?: string; text?: string; messageID?: string; sessionID?: string; id?: string }
          info?: { role?: string; sessionID?: string; id?: string; error?: { name?: string; data?: { message?: string } } }
          sessionID?: string
          error?: { name?: string; data?: { message?: string } } | string
          message?: string
        }
      }

      const eventSessionId = evt.properties?.sessionID ||
        evt.properties?.part?.sessionID ||
        evt.properties?.info?.sessionID

      if (evt.type !== 'server.connected' && eventSessionId && eventSessionId !== opencodeSessionId) {
        continue
      }

      if (evt.type === 'message.updated') {
        const info = evt.properties?.info
        if (info?.role === 'user' && info?.id) {
          userMessageId = info.id
        }
        if (info?.role === 'assistant' && info?.error) {
          const errorMsg = info.error.data?.message || info.error.name || 'Unknown OpenCode error'
          throw new Error(errorMsg)
        }
      }

      if (evt.type === 'message.part.updated') {
        const part = evt.properties?.part
        if (part?.type === 'text' && part?.text && part?.id) {
          if (part.messageID === userMessageId) continue

          const prevText = partTextCache.get(part.id) || ''
          const fullText = part.text
          const delta = fullText.slice(prevText.length)

          if (delta) {
            partTextCache.set(part.id, fullText)
            responseText = fullText
          }
        }
      }

      if (evt.type === 'session.idle' && evt.properties?.sessionID === opencodeSessionId) {
        break
      }

      if (evt.type === 'session.error' && evt.properties?.sessionID === opencodeSessionId) {
        const rawError = evt.properties?.error
        const errorMsg = evt.properties?.message
          || (typeof rawError === 'object' && rawError !== null
            ? (rawError.data?.message || rawError.name || JSON.stringify(rawError))
            : rawError)
          || 'OpenCode session error'
        throw new Error(errorMsg)
      }
    }

    // Wait for prompt to complete
    await promptPromise

    // Parse and execute actions from the response
    if (responseText) {
      try {
        // Extract JSON from the response (handle markdown code blocks)
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
            title?: string
            description?: string
            dueDate?: string
          }>
        }

        if (parsed.actions && Array.isArray(parsed.actions)) {
          const settings = getSettings()
          const fulcrumPort = settings.server?.port ?? 7777

          for (const action of parsed.actions) {
            if (action.type === 'create_task' && action.title) {
              try {
                const resp = await fetch(`http://localhost:${fulcrumPort}/api/tasks`, {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({
                    title: action.title,
                    description: action.description || null,
                    status: 'TO_DO',
                    tags: action.tags,
                    dueDate: action.dueDate || null,
                  }),
                })
                if (!resp.ok) {
                  log.messaging.warn('Observer failed to create task via OpenCode', {
                    sessionId,
                    status: resp.status,
                    title: action.title,
                  })
                } else {
                  log.messaging.info('Observer created task via OpenCode', {
                    sessionId,
                    title: action.title,
                  })
                  // Notify the user about the new task
                  try {
                    await fetch(`http://localhost:${fulcrumPort}/api/config/notifications/send`, {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({
                        title: `New task from ${options.channelType}`,
                        message: action.title,
                      }),
                    })
                  } catch {
                    // Best-effort notification, don't fail the flow
                  }
                }
              } catch (err) {
                log.messaging.warn('Observer task creation error via OpenCode', {
                  sessionId,
                  error: err instanceof Error ? err.message : String(err),
                })
              }
            } else if (action.type === 'store_memory' && action.content) {
              const source = action.source || `channel:${options.channelType}`
              await storeMemory({
                content: action.content,
                tags: action.tags,
                source,
              })
              log.messaging.info('Observer stored memory via OpenCode', {
                sessionId,
                source,
                contentPreview: action.content.slice(0, 100),
              })
            }
          }
        }
      } catch {
        // If parsing fails, that's okay — the observer just didn't find anything worth storing
        log.messaging.debug('Observer response was not valid JSON, skipping', {
          sessionId,
          responsePreview: responseText.slice(0, 200),
        })
      }
    }

    yield { type: 'done', data: {} }
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : String(err)
    log.messaging.error('OpenCode observer error', { sessionId, error: errorMsg })

    if (errorMsg.includes('ECONNREFUSED') || errorMsg.includes('fetch failed')) {
      opencodeClient = null
    }

    yield { type: 'error', data: { message: errorMsg } }
  }
}
