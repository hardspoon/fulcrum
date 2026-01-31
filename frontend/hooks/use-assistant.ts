import { useQuery } from '@tanstack/react-query'
import { fetchJSON } from '@/lib/api'

export interface SweepRun {
  id: string
  type: 'hourly' | 'morning_ritual' | 'evening_ritual'
  startedAt: string
  completedAt: string | null
  eventsProcessed: number | null
  tasksUpdated: number | null
  messagesSent: number | null
  summary: string | null
  status: 'running' | 'completed' | 'failed'
}

interface SweepsResponse {
  runs: SweepRun[]
}

export function useSweepRuns(options?: { type?: string; limit?: number }) {
  const params = new URLSearchParams()
  if (options?.type) params.set('type', options.type)
  if (options?.limit) params.set('limit', String(options.limit))

  const queryString = params.toString()
  const url = `/api/assistant/sweeps${queryString ? `?${queryString}` : ''}`

  return useQuery({
    queryKey: ['assistant', 'sweeps', options],
    queryFn: () => fetchJSON<SweepsResponse>(url),
    refetchInterval: 5000,
  })
}
