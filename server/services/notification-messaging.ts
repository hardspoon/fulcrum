/**
 * Thin wrapper for sending notifications via messaging channels.
 * Separated from channels/index.ts to allow independent mocking in notification tests
 * without affecting messaging channel tests.
 */
import { sendMessageToChannel } from './channels'

export async function sendNotificationViaMessaging(
  channel: 'whatsapp' | 'discord' | 'telegram' | 'slack',
  body: string
): Promise<{ success: boolean; error?: string }> {
  return sendMessageToChannel(channel, body)
}
