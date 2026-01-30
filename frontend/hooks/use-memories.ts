import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { fetchJSON } from '@/lib/api'

export interface Memory {
  id: string
  content: string
  tags: string[] | null
  source: string | null
  createdAt: string
  updatedAt: string
  rank?: number
}

interface MemoriesResponse {
  memories: Memory[]
  total: number
}

export function useMemories(options?: { tags?: string[]; limit?: number; offset?: number }) {
  const params = new URLSearchParams()
  if (options?.tags?.length) params.set('tags', options.tags.join(','))
  if (options?.limit) params.set('limit', String(options.limit))
  if (options?.offset) params.set('offset', String(options.offset))

  const queryString = params.toString()
  const url = `/api/memory${queryString ? `?${queryString}` : ''}`

  return useQuery({
    queryKey: ['memories', options],
    queryFn: () => fetchJSON<MemoriesResponse>(url),
    refetchInterval: 5000,
  })
}

export function useSearchMemories(query: string, options?: { tags?: string[]; limit?: number }) {
  const params = new URLSearchParams()
  params.set('q', query)
  if (options?.tags?.length) params.set('tags', options.tags.join(','))
  if (options?.limit) params.set('limit', String(options.limit))

  const url = `/api/memory/search?${params.toString()}`

  return useQuery({
    queryKey: ['memories', 'search', query, options],
    queryFn: () => fetchJSON<Memory[]>(url),
    enabled: query.trim().length > 0,
    refetchInterval: 5000,
  })
}

export function useUpdateMemory() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ id, content, tags }: { id: string; content?: string; tags?: string[] | null }) =>
      fetchJSON<Memory>(`/api/memory/${id}`, {
        method: 'PATCH',
        body: JSON.stringify({ content, tags }),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['memories'] })
    },
  })
}

export function useDeleteMemory() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (id: string) =>
      fetchJSON<{ success: boolean }>(`/api/memory/${id}`, { method: 'DELETE' }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['memories'] })
    },
  })
}
