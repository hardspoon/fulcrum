import {
  getNotificationSettings,
  type NotificationSettings,
  type SlackNotificationConfig,
  type DiscordNotificationConfig,
  type PushoverNotificationConfig,
  type GmailNotificationConfig,
} from '../lib/settings'
import { broadcast } from '../websocket/terminal-ws'
import { log } from '../lib/logger'
import { sendNotificationViaMessaging } from './notification-messaging'
import { eq } from 'drizzle-orm'
import { db, googleAccounts } from '../db'

export interface NotificationPayload {
  title: string
  message: string
  taskId?: string
  taskTitle?: string
  appId?: string
  appName?: string
  type: 'task_status_change' | 'pr_merged' | 'plan_complete' | 'deployment_success' | 'deployment_failed'
  url?: string
}

export interface NotificationResult {
  channel: string
  success: boolean
  error?: string
}

// Play notification sound via frontend (web audio)
// The server just signals to play; the frontend handles actual playback
async function sendSoundNotification(): Promise<NotificationResult> {
  // Sound is played by the frontend via WebSocket notification
  // This function exists for the test endpoint
  return { channel: 'sound', success: true }
}

// Send Slack notification via webhook
async function sendSlackNotification(
  config: SlackNotificationConfig,
  payload: NotificationPayload
): Promise<NotificationResult> {
  if (!config.webhookUrl) {
    return { channel: 'slack', success: false, error: 'Webhook URL not configured' }
  }

  try {
    const blocks = [
      {
        type: 'section',
        text: { type: 'mrkdwn', text: `*${payload.title}*\n${payload.message}` },
      },
    ]

    if (payload.url) {
      blocks.push({
        type: 'section',
        text: { type: 'mrkdwn', text: `<${payload.url}|View Task>` },
      })
    }

    const response = await fetch(config.webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text: payload.title, blocks }),
    })

    if (response.ok) {
      return { channel: 'slack', success: true }
    } else {
      return { channel: 'slack', success: false, error: `HTTP ${response.status}` }
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    return { channel: 'slack', success: false, error: message }
  }
}

// Send Discord notification via webhook
async function sendDiscordNotification(
  config: DiscordNotificationConfig,
  payload: NotificationPayload
): Promise<NotificationResult> {
  if (!config.webhookUrl) {
    return { channel: 'discord', success: false, error: 'Webhook URL not configured' }
  }

  try {
    const embed = {
      title: payload.title,
      description: payload.message,
      color: 0x5865f2, // Discord blurple
      url: payload.url,
    }

    const response = await fetch(config.webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ embeds: [embed] }),
    })

    if (response.ok || response.status === 204) {
      return { channel: 'discord', success: true }
    } else {
      return { channel: 'discord', success: false, error: `HTTP ${response.status}` }
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    return { channel: 'discord', success: false, error: message }
  }
}

// Send Pushover notification via API
async function sendPushoverNotification(
  config: PushoverNotificationConfig,
  payload: NotificationPayload
): Promise<NotificationResult> {
  if (!config.appToken || !config.userKey) {
    return { channel: 'pushover', success: false, error: 'App token or user key not configured' }
  }

  try {
    const body: Record<string, string> = {
      token: config.appToken,
      user: config.userKey,
      title: payload.title,
      message: payload.message,
    }

    if (payload.url) {
      body.url = payload.url
      body.url_title = 'View Task'
    }

    const response = await fetch('https://api.pushover.net/1/messages.json', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })

    if (response.ok) {
      return { channel: 'pushover', success: true }
    } else {
      const text = await response.text()
      return { channel: 'pushover', success: false, error: `HTTP ${response.status}: ${text}` }
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    return { channel: 'pushover', success: false, error: message }
  }
}

// Send notification via a messaging channel (WhatsApp, Telegram, Slack, Discord)
async function sendViaMessagingChannel(
  channel: 'whatsapp' | 'discord' | 'telegram' | 'slack',
  payload: NotificationPayload
): Promise<NotificationResult> {
  const text = `*${payload.title}*\n${payload.message}${payload.url ? `\n${payload.url}` : ''}`
  try {
    const result = await sendNotificationViaMessaging(channel, text)
    if (result.success) {
      return { channel, success: true }
    }
    return { channel, success: false, error: result.error }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    return { channel, success: false, error: message }
  }
}

// Auto-resolve Gmail account: if no accountId configured, use the only Gmail-enabled account
function autoResolveGmailAccountId(): string | null {
  const accounts = db
    .select({ id: googleAccounts.id })
    .from(googleAccounts)
    .where(eq(googleAccounts.gmailEnabled, true))
    .all()
  if (accounts.length === 1) return accounts[0].id
  return null
}

// Send Gmail notification via Gmail API
async function sendGmailNotification(
  config: GmailNotificationConfig,
  payload: NotificationPayload
): Promise<NotificationResult> {
  const accountId = config.googleAccountId || autoResolveGmailAccountId()
  if (!accountId) {
    return { channel: 'gmail', success: false, error: 'Google account not configured' }
  }

  try {
    const { sendEmail } = await import('./google/gmail-service')
    const subject = `Fulcrum: ${payload.title}`
    const body = `${payload.title}\n\n${payload.message}${payload.url ? `\n\n${payload.url}` : ''}`
    await sendEmail(accountId, { subject, body })
    return { channel: 'gmail', success: true }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    return { channel: 'gmail', success: false, error: message }
  }
}

// Broadcast notification to UI via WebSocket
function broadcastUINotification(
  payload: NotificationPayload,
  options: {
    showToast: boolean
    showDesktop: boolean
    playSound: boolean
    isCustomSound: boolean
  }
): void {
  const notificationType =
    payload.type === 'pr_merged' || payload.type === 'plan_complete' || payload.type === 'deployment_success'
      ? 'success'
      : payload.type === 'deployment_failed'
        ? 'error'
        : 'info'

  broadcast({
    type: 'notification',
    payload: {
      id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
      title: payload.title,
      message: payload.message,
      notificationType,
      taskId: payload.taskId,
      showToast: options.showToast, // Whether to show in-app toast
      showDesktop: options.showDesktop, // Whether to show browser/desktop notification
      playSound: options.playSound, // Tell desktop app to play local sound
      isCustomSound: options.isCustomSound, // Whether user has custom sound file (affects notification icon)
    },
  })
}

// Send notification to all enabled channels
export async function sendNotification(payload: NotificationPayload): Promise<NotificationResult[]> {
  const settings = getNotificationSettings()

  if (!settings.enabled) {
    return []
  }

  const results: NotificationResult[] = []
  const promises: Promise<void>[] = []

  // Determine notification options from settings
  const showToast = settings.toast?.enabled ?? true
  const showDesktop = settings.desktop?.enabled ?? true
  const playSound = settings.sound?.enabled ?? false
  const isCustomSound = !!settings.sound?.customSoundFile

  // Always broadcast to UI (frontend will respect showToast/showDesktop flags)
  broadcastUINotification(payload, { showToast, showDesktop, playSound, isCustomSound })

  // Sound (macOS only)
  if (settings.sound?.enabled) {
    promises.push(
      sendSoundNotification()
        .then((r) => results.push(r))
        .catch((e) => results.push({ channel: 'sound', success: false, error: e.message }))
    )
  }

  // Slack (webhook or messaging channel)
  if (settings.slack?.enabled) {
    if (settings.slack.useMessagingChannel) {
      promises.push(
        sendViaMessagingChannel('slack', payload)
          .then((r) => results.push(r))
          .catch((e) => results.push({ channel: 'slack', success: false, error: e.message }))
      )
    } else {
      promises.push(
        sendSlackNotification(settings.slack, payload)
          .then((r) => results.push(r))
          .catch((e) => results.push({ channel: 'slack', success: false, error: e.message }))
      )
    }
  }

  // Discord (webhook or messaging channel)
  if (settings.discord?.enabled) {
    if (settings.discord.useMessagingChannel) {
      promises.push(
        sendViaMessagingChannel('discord', payload)
          .then((r) => results.push(r))
          .catch((e) => results.push({ channel: 'discord', success: false, error: e.message }))
      )
    } else {
      promises.push(
        sendDiscordNotification(settings.discord, payload)
          .then((r) => results.push(r))
          .catch((e) => results.push({ channel: 'discord', success: false, error: e.message }))
      )
    }
  }

  // Pushover
  if (settings.pushover?.enabled) {
    promises.push(
      sendPushoverNotification(settings.pushover, payload)
        .then((r) => results.push(r))
        .catch((e) => results.push({ channel: 'pushover', success: false, error: e.message }))
    )
  }

  // WhatsApp (via messaging channel)
  if (settings.whatsapp?.enabled) {
    promises.push(
      sendViaMessagingChannel('whatsapp', payload)
        .then((r) => results.push(r))
        .catch((e) => results.push({ channel: 'whatsapp', success: false, error: e.message }))
    )
  }

  // Telegram (via messaging channel)
  if (settings.telegram?.enabled) {
    promises.push(
      sendViaMessagingChannel('telegram', payload)
        .then((r) => results.push(r))
        .catch((e) => results.push({ channel: 'telegram', success: false, error: e.message }))
    )
  }

  // Gmail (via Gmail API)
  if (settings.gmail?.enabled) {
    promises.push(
      sendGmailNotification(settings.gmail, payload)
        .then((r) => results.push(r))
        .catch((e) => results.push({ channel: 'gmail', success: false, error: e.message }))
    )
  }

  await Promise.allSettled(promises)

  // Log failures
  for (const result of results) {
    if (!result.success) {
      log.notification.warn('Notification failed', { channel: result.channel, error: result.error })
    }
  }

  return results
}

// Test a specific notification channel
export async function testNotificationChannel(
  channel: 'sound' | 'slack' | 'discord' | 'pushover' | 'whatsapp' | 'telegram' | 'gmail',
  settings?: NotificationSettings
): Promise<NotificationResult> {
  const config = settings ?? getNotificationSettings()
  const testPayload: NotificationPayload = {
    title: 'Test Notification',
    message: 'This is a test notification from Fulcrum.',
    type: 'task_status_change',
  }

  switch (channel) {
    case 'sound':
      // Broadcast to UI to play sound (frontend handles actual playback)
      broadcastUINotification(testPayload, {
        showToast: false, // Don't show toast for sound test
        showDesktop: false, // Don't show desktop notification for sound test
        playSound: true,
        isCustomSound: !!config.sound?.customSoundFile,
      })
      return { channel: 'sound', success: true }
    case 'slack':
      if (config.slack?.useMessagingChannel) {
        return sendViaMessagingChannel('slack', testPayload)
      }
      return sendSlackNotification(config.slack, testPayload)
    case 'discord':
      if (config.discord?.useMessagingChannel) {
        return sendViaMessagingChannel('discord', testPayload)
      }
      return sendDiscordNotification(config.discord, testPayload)
    case 'pushover':
      return sendPushoverNotification(config.pushover, testPayload)
    case 'whatsapp':
      return sendViaMessagingChannel('whatsapp', testPayload)
    case 'telegram':
      return sendViaMessagingChannel('telegram', testPayload)
    case 'gmail':
      return sendGmailNotification(config.gmail, testPayload)
    default:
      return { channel, success: false, error: 'Unknown channel' }
  }
}
