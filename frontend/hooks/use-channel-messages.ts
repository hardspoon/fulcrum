import { useQuery } from '@tanstack/react-query'

export type ChannelType = 'whatsapp' | 'discord' | 'telegram' | 'slack' | 'email'

export interface ChannelMessage {
  id: string
  channelType: ChannelType
  connectionId: string
  direction: 'incoming' | 'outgoing'
  senderId: string
  senderName: string | null
  recipientId: string | null
  content: string
  metadata: Record<string, unknown> | null
  messageTimestamp: string
  createdAt: string
}

export interface ChannelMessagesResponse {
  messages: ChannelMessage[]
  count: number
}

export interface UseChannelMessagesOptions {
  channel?: ChannelType | 'all'
  direction?: 'incoming' | 'outgoing'
  search?: string
  limit?: number
  offset?: number
}

export function useChannelMessages(options: UseChannelMessagesOptions = {}) {
  const { channel = 'all', direction, search, limit = 50, offset = 0 } = options

  return useQuery<ChannelMessagesResponse>({
    queryKey: ['channel-messages', channel, direction, search, limit, offset],
    queryFn: async () => {
      const params = new URLSearchParams()
      if (channel) params.set('channel', channel)
      if (direction) params.set('direction', direction)
      if (search) params.set('search', search)
      params.set('limit', String(limit))
      params.set('offset', String(offset))

      const response = await fetch(`/api/monitoring/channel-messages?${params.toString()}`)
      if (!response.ok) {
        throw new Error('Failed to fetch channel messages')
      }
      return response.json()
    },
    refetchInterval: 30000, // Refresh every 30 seconds
  })
}

export function useChannelMessageCounts() {
  return useQuery<Record<string, number>>({
    queryKey: ['channel-message-counts'],
    queryFn: async () => {
      const response = await fetch('/api/monitoring/channel-message-counts')
      if (!response.ok) {
        throw new Error('Failed to fetch channel message counts')
      }
      return response.json()
    },
    refetchInterval: 30000, // Refresh every 30 seconds
  })
}
