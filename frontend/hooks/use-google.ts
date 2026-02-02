/**
 * React Query hooks for Google API integration (Calendar + Gmail)
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { fetchJSON } from '@/lib/api'
import { createLogger } from '@/lib/logger'

const logger = createLogger('GoogleOAuth')

const API_BASE = ''

// Types
export interface GoogleAccount {
  id: string
  name: string
  email: string | null
  calendarEnabled: boolean | null
  gmailEnabled: boolean | null
  syncIntervalMinutes: number | null
  lastCalendarSyncAt: string | null
  lastCalendarSyncError: string | null
  lastGmailSyncAt: string | null
  lastGmailSyncError: string | null
  sendAsEmail: string | null
  createdAt: string
  updatedAt: string
}

export interface GmailSendAsAlias {
  email: string
  displayName: string | null
  isDefault: boolean
}

export interface GmailDraftSummary {
  id: string
  gmailDraftId: string
  to: string[]
  cc: string[]
  subject: string | null
  snippet: string | null
  updatedAt: string
}

// ==========================================
// Account hooks
// ==========================================

export function useGoogleAccounts() {
  return useQuery({
    queryKey: ['google', 'accounts'],
    queryFn: () =>
      fetchJSON<{ accounts: GoogleAccount[] }>(`${API_BASE}/api/google/accounts`).then(
        (r) => r.accounts
      ),
  })
}

export function useGoogleAccount(id: string | undefined) {
  return useQuery({
    queryKey: ['google', 'accounts', id],
    queryFn: () => fetchJSON<GoogleAccount>(`${API_BASE}/api/google/accounts/${id}`),
    enabled: !!id,
  })
}

export function useUpdateGoogleAccount() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({
      id,
      ...updates
    }: {
      id: string
      name?: string
      syncIntervalMinutes?: number
      sendAsEmail?: string | null
    }) =>
      fetchJSON<GoogleAccount>(`${API_BASE}/api/google/accounts/${id}`, {
        method: 'PATCH',
        body: JSON.stringify(updates),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['google'] })
    },
  })
}

export function useDeleteGoogleAccount() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (id: string) =>
      fetchJSON<{ success: boolean }>(`${API_BASE}/api/google/accounts/${id}`, {
        method: 'DELETE',
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['google'] })
      queryClient.invalidateQueries({ queryKey: ['caldav'] })
    },
  })
}

// ==========================================
// Calendar enable/disable/sync
// ==========================================

export function useEnableGoogleCalendar() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (id: string) =>
      fetchJSON<{ success: boolean }>(
        `${API_BASE}/api/google/accounts/${id}/enable-calendar`,
        { method: 'POST' }
      ),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['google'] })
      queryClient.invalidateQueries({ queryKey: ['caldav'] })
    },
  })
}

export function useDisableGoogleCalendar() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (id: string) =>
      fetchJSON<{ success: boolean }>(
        `${API_BASE}/api/google/accounts/${id}/disable-calendar`,
        { method: 'POST' }
      ),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['google'] })
      queryClient.invalidateQueries({ queryKey: ['caldav'] })
    },
  })
}

export function useSyncGoogleCalendar() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (id: string) =>
      fetchJSON<{ success: boolean }>(`${API_BASE}/api/google/accounts/${id}/sync`, {
        method: 'POST',
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['google'] })
      queryClient.invalidateQueries({ queryKey: ['caldav'] })
    },
  })
}

// ==========================================
// Gmail enable/disable
// ==========================================

export function useEnableGmail() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (id: string) =>
      fetchJSON<{ success: boolean }>(
        `${API_BASE}/api/google/accounts/${id}/enable-gmail`,
        { method: 'POST' }
      ),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['google'] })
    },
  })
}

export function useDisableGmail() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (id: string) =>
      fetchJSON<{ success: boolean }>(
        `${API_BASE}/api/google/accounts/${id}/disable-gmail`,
        { method: 'POST' }
      ),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['google'] })
    },
  })
}

// ==========================================
// Gmail Send-As Aliases
// ==========================================

export function useGmailSendAsAliases(accountId: string | undefined) {
  return useQuery({
    queryKey: ['google', 'send-as', accountId],
    queryFn: () =>
      fetchJSON<{ aliases: GmailSendAsAlias[] }>(
        `${API_BASE}/api/google/accounts/${accountId}/send-as`
      ).then((r) => r.aliases),
    enabled: !!accountId,
  })
}

// ==========================================
// Gmail Drafts
// ==========================================

export function useGmailDrafts(accountId: string | undefined) {
  return useQuery({
    queryKey: ['google', 'drafts', accountId],
    queryFn: () =>
      fetchJSON<{ drafts: GmailDraftSummary[] }>(
        `${API_BASE}/api/google/accounts/${accountId}/drafts`
      ).then((r) => r.drafts),
    enabled: !!accountId,
  })
}

export function useCreateGmailDraft() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({
      accountId,
      ...input
    }: {
      accountId: string
      to?: string[]
      cc?: string[]
      bcc?: string[]
      subject?: string
      body?: string
      htmlBody?: string
    }) =>
      fetchJSON<{ draftId: string; messageId: string | null }>(
        `${API_BASE}/api/google/accounts/${accountId}/drafts`,
        {
          method: 'POST',
          body: JSON.stringify(input),
        }
      ),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['google', 'drafts'] })
    },
  })
}

export function useUpdateGmailDraft() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({
      accountId,
      draftId,
      ...input
    }: {
      accountId: string
      draftId: string
      to?: string[]
      cc?: string[]
      bcc?: string[]
      subject?: string
      body?: string
      htmlBody?: string
    }) =>
      fetchJSON<{ draftId: string; messageId: string | null }>(
        `${API_BASE}/api/google/accounts/${accountId}/drafts/${draftId}`,
        {
          method: 'PATCH',
          body: JSON.stringify(input),
        }
      ),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['google', 'drafts'] })
    },
  })
}

export function useDeleteGmailDraft() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ accountId, draftId }: { accountId: string; draftId: string }) =>
      fetchJSON<{ success: boolean }>(
        `${API_BASE}/api/google/accounts/${accountId}/drafts/${draftId}`,
        { method: 'DELETE' }
      ),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['google', 'drafts'] })
    },
  })
}

// ==========================================
// OAuth
// ==========================================

export function useGoogleOAuthUrl() {
  return useMutation({
    mutationFn: async (input: { accountName?: string; accountId?: string }) => {
      const params = new URLSearchParams()
      if (input.accountName) params.set('accountName', input.accountName)
      if (input.accountId) params.set('accountId', input.accountId)
      // Pass browser origin so the server builds the correct redirect URI
      // (immune to proxy Host header rewrites)
      params.set('origin', window.location.origin)

      const url = `${API_BASE}/api/google/oauth/authorize?${params.toString()}`
      logger.info('Requesting OAuth authorize URL', {
        origin: window.location.origin,
        href: window.location.href,
        fetchUrl: url,
        accountName: input.accountName,
        accountId: input.accountId,
      })

      const result = await fetchJSON<{ authUrl: string }>(url)

      // Parse the returned auth URL to log the redirect_uri Google will see
      try {
        const authUrl = new URL(result.authUrl)
        logger.info('Got OAuth auth URL from server', {
          authUrl: result.authUrl,
          redirect_uri: authUrl.searchParams.get('redirect_uri'),
          client_id: authUrl.searchParams.get('client_id'),
          scope: authUrl.searchParams.get('scope'),
          state: authUrl.searchParams.get('state'),
        })
      } catch {
        logger.info('Got OAuth auth URL from server (unparseable)', {
          authUrl: result.authUrl,
        })
      }

      return result
    },
  })
}
