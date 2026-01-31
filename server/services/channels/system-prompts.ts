/**
 * Context-specific system prompt additions for messaging channels.
 * These are appended to the baseline prompt (instance context + knowledge).
 */

import type { ChannelType } from './types'

// ==================== Messaging Prompts ====================

/**
 * Context passed to incoming message prompts
 */
export interface MessagingContext {
  channel: string
  sender: string
  senderName?: string
  content: string
  metadata?: {
    subject?: string
    threadId?: string
    messageId?: string
  }
}

/**
 * Get context-specific additions for real-time message handling.
 * The assistant decides whether to respond, create events, tasks, etc.
 */
export function getMessagingSystemPrompt(channelType: ChannelType, context: MessagingContext): string {
  const formattingGuide = getFormattingGuide(channelType)

  return `## Incoming Message

A message has arrived:

**Channel**: ${context.channel}
**From**: ${context.sender}${context.senderName ? ` (${context.senderName})` : ''}
**Content**: ${context.content}
${context.metadata?.subject ? `**Subject**: ${context.metadata.subject}` : ''}
${context.metadata?.threadId ? `**Thread ID**: ${context.metadata.threadId}` : ''}

## Your Task

1. **Assess the message** - Is this:
   - A casual greeting or question? → Just reply, no need to track
   - An actionable request (todo, reminder, follow-up)? → Track it
   - Spam/newsletter/automated notification? → Ignore silently
   - Related to an existing task? → Link and potentially reply

2. **Take appropriate action(s)**:
   - **Simple conversations**: Just use \`message\` to reply - no tracking needed for "hi", "thanks", general questions
   - **Actionable requests**: Store a memory (via \`memory_store\`) with tag \`actionable\`, optionally create a Fulcrum task
   - **Spam/newsletters**: Silently ignore (no response)

## Important

- **You don't need to store a memory for every message** - only for things that need tracking/follow-up
- Simple greetings, questions, and conversations can be answered directly without any memory tracking
- For replies, use the \`message\` tool with: channel="${context.channel}", to="${context.sender}"${context.metadata?.messageId ? `, replyToMessageId="${context.metadata.messageId}"` : ''}
- Only store memories with tag \`actionable\` for requests, reminders, or things you need to remember
- Spam, newsletters, and automated notifications should be ignored (no response)

${formattingGuide}`
}

/**
 * Get context-specific additions for observe-only message processing.
 * Used for messages the assistant can see but should not respond to
 * (e.g., WhatsApp messages not in self-chat).
 */
export function getObserveOnlySystemPrompt(channelType: ChannelType, context: MessagingContext): string {
  return `## Observe-Only Mode

You are OBSERVING a message (read-only mode):

**Channel**: ${context.channel}
**From**: ${context.sender}${context.senderName ? ` (${context.senderName})` : ''}
**Content**: ${context.content}
${context.metadata?.subject ? `**Subject**: ${context.metadata.subject}` : ''}
${(context.metadata as { isGroup?: boolean })?.isGroup ? `**Group Chat**: yes` : ''}

## Important Constraints

**DO NOT RESPOND** - You cannot send messages to this recipient. You are only observing.

## Your Task

Silently analyze this message and decide if it needs to be tracked:

1. **Actionable requests directed at the user** (deadlines, meetings, tasks) → Store a memory with tag \`actionable\`
2. **Important information** (confirmations, updates about ongoing matters) → Store a memory with tag \`monitoring\`
3. **Casual messages, spam, or irrelevant content** → Do nothing

Use \`memory_store\` to persist important observations. Include the source channel as the \`source\` field (e.g., "channel:${context.channel}").

**Remember: NO responses. Observe only.**`
}

/**
 * Get context-specific additions for hourly sweeps.
 */
export function getSweepSystemPrompt(context: {
  lastSweepTime: string | null
  actionableMemoryCount: number
  openTaskCount: number
}): string {
  return `## Hourly Sweep

**This is a non-interactive background session. Do not ask questions or wait for user input.**

You are performing your hourly sweep.

**Context:**
- Last sweep completed: ${context.lastSweepTime ?? 'never'}
- Memories tagged 'actionable': ${context.actionableMemoryCount}
- Open Fulcrum tasks (TO_DO + IN_PROGRESS + IN_REVIEW): ${context.openTaskCount}

## Your Task

1. **Review actionable memories** - use \`memory_search\` to find memories tagged \`actionable\` or \`monitoring\` and check for:
   - Items that have been resolved (delete the memory or remove the tag)
   - Patterns or connections between tracked items
   - Items that should be linked to tasks

2. **Review Fulcrum tasks** - use \`list_tasks\` to get tasks that are TO_DO, IN_PROGRESS, or IN_REVIEW:
   - Any that need attention or follow-up?
   - Any related to tracked memories?
   - Any blocked or overdue?

3. **Catch up** - if you find messages that weren't properly handled:
   - Store memories with tag \`actionable\` for missed items
   - Take action if still relevant

4. **Update your records** - delete resolved memories or update their tags

## Output

After completing your sweep, provide a brief summary of:
- Memories reviewed and actions taken
- Tasks updated or created
- Any patterns noticed
- Items requiring user attention`
}

/**
 * Get context-specific additions for daily rituals (morning/evening).
 */
export function getRitualSystemPrompt(type: 'morning' | 'evening'): string {
  if (type === 'morning') {
    return `## Morning Ritual

**This is a non-interactive background session. Do not ask questions or wait for user input.**

You are performing your morning ritual.

## Output Channels

Use the \`list_messaging_channels\` tool to discover which messaging channels are available and connected.
Then use the \`message\` tool to send your briefing to the connected channels.`
  }

  return `## Evening Ritual

**This is a non-interactive background session. Do not ask questions or wait for user input.**

You are performing your evening ritual.

## Output Channels

Use the \`list_messaging_channels\` tool to discover which messaging channels are available and connected.
Then use the \`message\` tool to send your summary to the connected channels.`
}

/**
 * Get formatting guidelines for a channel type.
 */
function getFormattingGuide(channelType: ChannelType): string {
  switch (channelType) {
    case 'whatsapp':
      return `## WhatsApp Formatting

WhatsApp does NOT render full Markdown. Keep formatting simple:
- *bold* using asterisks, _italic_ using underscores
- No markdown headers or links
- Keep responses concise for mobile`

    case 'slack':
      return `## Slack Formatting & Block Kit

Your response will be sent using Slack Block Kit for rich formatting. Structure your response as JSON with:

- **body**: Plain text message (required, shown in notifications and as fallback)
- **blocks**: Array of Block Kit blocks for rich formatting (optional)

### Block Kit Blocks

**Section Block** - Main content:
\`\`\`json
{ "type": "section", "text": { "type": "mrkdwn", "text": "*Bold* and _italic_" } }
\`\`\`

**Section with Fields** - Multi-column layout:
\`\`\`json
{ "type": "section", "fields": [
  { "type": "mrkdwn", "text": "*Status:*\\nIn Progress" },
  { "type": "mrkdwn", "text": "*Due:*\\nToday" }
] }
\`\`\`

**Header Block** - Large text headers:
\`\`\`json
{ "type": "header", "text": { "type": "plain_text", "text": "Task Summary", "emoji": true } }
\`\`\`

**Divider Block** - Horizontal rule:
\`\`\`json
{ "type": "divider" }
\`\`\`

**Context Block** - Small muted text:
\`\`\`json
{ "type": "context", "elements": [{ "type": "mrkdwn", "text": "Last updated 5 min ago" }] }
\`\`\`

### mrkdwn Syntax
- *bold* with single asterisks
- _italic_ with underscores
- ~strikethrough~ with tildes
- \`code\` with backticks
- > blockquotes
- Links: <url|text>
- Lists: Use • or numbered (1. 2. 3.)

### When to Use Blocks
- **Lists/Status**: Use section blocks with bullet points or fields
- **Structured Data**: Use fields for key-value pairs side by side
- **Headers**: Use header blocks for major sections
- **Simple Responses**: Just use plain text body, no blocks needed

Use the \`message\` tool with the \`slack_blocks\` parameter to send Block Kit formatted messages.`

    case 'discord':
      return `## Discord Formatting

Discord supports full Markdown:
- **bold**, *italic*, ~~strikethrough~~
- \`code\` and \`\`\`code blocks\`\`\` with syntax highlighting
- > blockquotes, - lists
- [text](url) links
- Keep under 2000 characters per message`

    case 'email':
      return `## Email Formatting

Your response will be sent as HTML email. You can use full Markdown.
- Headers, bold, italic, code blocks all work
- Longer responses are acceptable
- Use clear structure with headers for longer replies`

    default:
      return `## Formatting

Keep responses clear and concise. Use basic formatting only.`
  }
}
