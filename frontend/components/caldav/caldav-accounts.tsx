/**
 * CalDAV Multi-Account Management Component
 *
 * Replaces the old single-account caldav-setup.tsx with support for
 * multiple CalDAV accounts (Google OAuth + Basic Auth).
 */

import { useState, useEffect, useRef } from 'react'
import { toast } from 'sonner'
import { useTranslation } from 'react-i18next'
import { Switch } from '@/components/ui/switch'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { HugeiconsIcon } from '@hugeicons/react'
import {
  Loading03Icon,
  Tick02Icon,
  RefreshIcon,
  Cancel01Icon,
  Add01Icon,
  Delete02Icon,
} from '@hugeicons/core-free-icons'
import {
  useCaldavStatus,
  useCaldavAccounts,
  useCreateCaldavAccount,
  useCreateGoogleCaldavAccount,
  useDeleteCaldavAccount,
  useEnableCaldavAccount,
  useDisableCaldavAccount,
  useSyncCaldavAccount,
  useGetAccountGoogleAuthUrl,
  useEnableCaldav,
  useDisableCaldav,
} from '@/hooks/use-caldav'
import { usePort } from '@/hooks/use-config'

interface CaldavAccountsProps {
  isLoading?: boolean
}

export function CaldavAccounts({ isLoading = false }: CaldavAccountsProps) {
  const { t } = useTranslation('settings')
  const { data: status, refetch: refetchStatus } = useCaldavStatus()
  const { data: accounts } = useCaldavAccounts()
  const createAccount = useCreateCaldavAccount()
  const createGoogleAccount = useCreateGoogleCaldavAccount()
  const deleteAccount = useDeleteCaldavAccount()
  const enableAccount = useEnableCaldavAccount()
  const disableAccount = useDisableCaldavAccount()
  const syncAccount = useSyncCaldavAccount()
  const getAccountAuthUrl = useGetAccountGoogleAuthUrl()
  const enableCaldav = useEnableCaldav()
  const disableCaldav = useDisableCaldav()
  const backendPort = usePort()

  const [showAddForm, setShowAddForm] = useState(false)
  const [activeTab, setActiveTab] = useState<string>('google')

  // Basic auth fields
  const [accountName, setAccountName] = useState('')
  const [serverUrl, setServerUrl] = useState('')
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [syncInterval, setSyncInterval] = useState('15')

  // Google OAuth fields
  const [googleAccountName, setGoogleAccountName] = useState('')
  const [googleClientId, setGoogleClientId] = useState('')
  const [googleClientSecret, setGoogleClientSecret] = useState('')
  const [googleSyncInterval, setGoogleSyncInterval] = useState('15')
  const [isPollingForConnect, setIsPollingForConnect] = useState(false)
  const [pendingGoogleAccountId, setPendingGoogleAccountId] = useState<string | null>(null)
  const pollIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const isGlobalEnabled = status?.connected === true || (status?.accounts ?? []).length > 0

  // Poll for Google OAuth connection completion
  useEffect(() => {
    if (isPollingForConnect && pendingGoogleAccountId) {
      pollIntervalRef.current = setInterval(() => {
        refetchStatus()
      }, 2000)
    }

    // Check if the pending account is now connected
    if (isPollingForConnect && pendingGoogleAccountId && status?.accounts) {
      const account = status.accounts.find((a) => a.id === pendingGoogleAccountId)
      if (account?.connected) {
        setIsPollingForConnect(false)
        setPendingGoogleAccountId(null)
        setShowAddForm(false)
        setGoogleAccountName('')
        setGoogleClientId('')
        setGoogleClientSecret('')
        toast.success(t('caldav.configured'))
      }
    }

    return () => {
      if (pollIntervalRef.current) {
        clearInterval(pollIntervalRef.current)
        pollIntervalRef.current = null
      }
    }
  }, [isPollingForConnect, pendingGoogleAccountId, status?.accounts, refetchStatus, t])

  const handleGlobalToggle = async (enabled: boolean) => {
    try {
      if (enabled) {
        await enableCaldav.mutateAsync()
      } else {
        await disableCaldav.mutateAsync()
      }
      refetchStatus()
    } catch {
      toast.error(t('caldav.toggleFailed'))
    }
  }

  const handleSyncAccount = async (id: string) => {
    try {
      await syncAccount.mutateAsync(id)
      toast.success(t('caldav.syncComplete'))
      refetchStatus()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t('caldav.syncFailed'))
    }
  }

  const handleToggleAccount = async (id: string, currentlyEnabled: boolean) => {
    try {
      if (currentlyEnabled) {
        await disableAccount.mutateAsync(id)
      } else {
        await enableAccount.mutateAsync(id)
      }
      refetchStatus()
    } catch {
      toast.error(t('caldav.toggleFailed'))
    }
  }

  const handleDeleteAccount = async (id: string) => {
    try {
      await deleteAccount.mutateAsync(id)
      toast.success(t('caldav.disconnected'))
      refetchStatus()
    } catch {
      toast.error(t('caldav.disconnectFailed'))
    }
  }

  const handleBasicConnect = async () => {
    if (!serverUrl.trim() || !username.trim() || !password.trim()) {
      toast.error(t('caldav.fillRequired'))
      return
    }

    try {
      await createAccount.mutateAsync({
        name: accountName.trim() || username.trim(),
        serverUrl: serverUrl.trim(),
        username: username.trim(),
        password: password.trim(),
        syncIntervalMinutes: parseInt(syncInterval, 10) || 15,
      })
      setShowAddForm(false)
      setAccountName('')
      setServerUrl('')
      setUsername('')
      setPassword('')
      setSyncInterval('15')
      toast.success(t('caldav.configured'))
      refetchStatus()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t('caldav.configureFailed'))
    }
  }

  const handleGoogleConnect = async () => {
    if (!googleClientId.trim() || !googleClientSecret.trim()) {
      toast.error(t('caldav.googleFillRequired'))
      return
    }

    try {
      // Create the Google account first
      const account = await createGoogleAccount.mutateAsync({
        name: googleAccountName.trim() || 'Google Calendar',
        googleClientId: googleClientId.trim(),
        googleClientSecret: googleClientSecret.trim(),
        syncIntervalMinutes: parseInt(googleSyncInterval, 10) || 15,
      })

      // Get authorization URL for this account
      const { authUrl } = await getAccountAuthUrl.mutateAsync(account.id)

      // Open in new window
      window.open(authUrl, '_blank', 'noopener')
      toast.info(t('caldav.googleAuthStarted'))

      // Start polling for connection
      setPendingGoogleAccountId(account.id)
      setIsPollingForConnect(true)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t('caldav.configureFailed'))
    }
  }

  const resetAddForm = () => {
    setShowAddForm(false)
    setIsPollingForConnect(false)
    setPendingGoogleAccountId(null)
    setAccountName('')
    setServerUrl('')
    setUsername('')
    setPassword('')
    setSyncInterval('15')
    setGoogleAccountName('')
    setGoogleClientId('')
    setGoogleClientSecret('')
    setGoogleSyncInterval('15')
  }

  const isPending =
    createAccount.isPending ||
    createGoogleAccount.isPending ||
    getAccountAuthUrl.isPending ||
    deleteAccount.isPending ||
    enableAccount.isPending ||
    disableAccount.isPending ||
    syncAccount.isPending ||
    enableCaldav.isPending ||
    disableCaldav.isPending

  const accountStatuses = status?.accounts ?? []

  return (
    <div className="space-y-4">
      {/* Global CalDAV enable/disable toggle */}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <label className="text-sm text-muted-foreground sm:w-40 sm:shrink-0">
          {t('caldav.label')}
        </label>
        <div className="flex items-center gap-3">
          <Switch
            checked={isGlobalEnabled}
            onCheckedChange={handleGlobalToggle}
            disabled={isLoading || isPending}
          />
          {enableCaldav.isPending && (
            <span className="flex items-center gap-2 text-sm">
              <HugeiconsIcon icon={Loading03Icon} size={14} strokeWidth={2} className="animate-spin text-yellow-500" />
              <span className="text-muted-foreground">{t('caldav.statusConnecting')}</span>
            </span>
          )}
        </div>
      </div>

      {/* Account list */}
      {accountStatuses.length > 0 && (
        <div className="ml-4 sm:ml-44 space-y-2">
          {accountStatuses.map((acct) => {
            const fullAccount = accounts?.find((a) => a.id === acct.id)
            const authType = fullAccount?.authType ?? 'basic'

            return (
              <div
                key={acct.id}
                className="flex items-center gap-3 rounded-md border px-3 py-2"
              >
                {/* Status indicator */}
                <div className="shrink-0">
                  {acct.syncing ? (
                    <HugeiconsIcon icon={Loading03Icon} size={14} strokeWidth={2} className="animate-spin text-yellow-500" />
                  ) : acct.lastError ? (
                    <HugeiconsIcon icon={Cancel01Icon} size={14} strokeWidth={2} className="text-red-500" />
                  ) : acct.connected ? (
                    <HugeiconsIcon icon={Tick02Icon} size={14} strokeWidth={2} className="text-green-500" />
                  ) : (
                    <span className="inline-block h-3.5 w-3.5 rounded-full border border-muted-foreground/40" />
                  )}
                </div>

                {/* Account info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium truncate">{acct.name}</span>
                    <span className="shrink-0 rounded bg-muted px-1.5 py-0.5 text-[10px] font-medium uppercase text-muted-foreground">
                      {authType === 'google-oauth' ? 'Google' : 'Basic'}
                    </span>
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {acct.connected
                      ? `${acct.calendarCount} calendar${acct.calendarCount !== 1 ? 's' : ''}`
                      : acct.lastError
                        ? acct.lastError
                        : !acct.enabled
                          ? t('caldav.disabled') ?? 'Disabled'
                          : t('caldav.statusConnecting')}
                  </div>
                </div>

                {/* Actions */}
                <div className="flex items-center gap-1 shrink-0">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7"
                    onClick={() => handleSyncAccount(acct.id)}
                    disabled={isPending || acct.syncing || !acct.enabled}
                    title={t('caldav.syncButton')}
                  >
                    <HugeiconsIcon
                      icon={RefreshIcon}
                      size={14}
                      strokeWidth={2}
                      className={acct.syncing ? 'animate-spin' : ''}
                    />
                  </Button>
                  <Switch
                    checked={acct.enabled}
                    onCheckedChange={() => handleToggleAccount(acct.id, acct.enabled)}
                    disabled={isPending}
                    className="scale-75"
                  />
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 text-destructive hover:text-destructive"
                    onClick={() => handleDeleteAccount(acct.id)}
                    disabled={isPending}
                    title={t('caldav.deleteAccount') ?? 'Delete'}
                  >
                    <HugeiconsIcon icon={Delete02Icon} size={14} strokeWidth={2} />
                  </Button>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Add Account button / form */}
      {!showAddForm && (
        <div className="ml-4 sm:ml-44">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowAddForm(true)}
            disabled={isPending}
          >
            <HugeiconsIcon icon={Add01Icon} size={14} strokeWidth={2} className="mr-2" />
            {t('caldav.addAccount')}
          </Button>
        </div>
      )}

      {showAddForm && (
        <div className="ml-4 sm:ml-44">
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList>
              <TabsTrigger value="google">{t('caldav.tabGoogle')}</TabsTrigger>
              <TabsTrigger value="basic">{t('caldav.tabBasic')}</TabsTrigger>
            </TabsList>

            {/* Basic CalDAV tab */}
            <TabsContent value="basic">
              <div className="space-y-3 pt-2">
                <div className="space-y-2">
                  <label className="block text-xs text-muted-foreground">{t('caldav.accountName')}</label>
                  <Input
                    type="text"
                    placeholder={t('caldav.accountNamePlaceholder') ?? 'My CalDAV Server'}
                    value={accountName}
                    onChange={(e) => setAccountName(e.target.value)}
                    className="max-w-md text-sm"
                  />
                </div>
                <div className="space-y-2">
                  <label className="block text-xs text-muted-foreground">{t('caldav.serverUrl')}</label>
                  <Input
                    type="url"
                    placeholder={t('caldav.serverUrlPlaceholder')}
                    value={serverUrl}
                    onChange={(e) => setServerUrl(e.target.value)}
                    className="max-w-md font-mono text-sm"
                  />
                </div>
                <div className="space-y-2">
                  <label className="block text-xs text-muted-foreground">{t('caldav.username')}</label>
                  <Input
                    type="text"
                    placeholder={t('caldav.usernamePlaceholder')}
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    className="max-w-md text-sm"
                  />
                </div>
                <div className="space-y-2">
                  <label className="block text-xs text-muted-foreground">{t('caldav.password')}</label>
                  <Input
                    type="password"
                    placeholder={t('caldav.passwordPlaceholder')}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="max-w-md font-mono text-sm"
                  />
                </div>
                <div className="space-y-2">
                  <label className="block text-xs text-muted-foreground">{t('caldav.syncInterval')}</label>
                  <Input
                    type="number"
                    min={1}
                    max={1440}
                    value={syncInterval}
                    onChange={(e) => setSyncInterval(e.target.value)}
                    className="w-24 text-sm"
                  />
                </div>
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    onClick={handleBasicConnect}
                    disabled={isPending || !serverUrl.trim() || !username.trim() || !password.trim()}
                  >
                    {createAccount.isPending ? (
                      <HugeiconsIcon icon={Loading03Icon} size={14} strokeWidth={2} className="mr-2 animate-spin" />
                    ) : null}
                    {t('caldav.connectButton')}
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={resetAddForm}
                    disabled={isPending}
                  >
                    {t('caldav.cancelButton')}
                  </Button>
                </div>
              </div>
            </TabsContent>

            {/* Google Calendar tab */}
            <TabsContent value="google">
              <div className="space-y-3 pt-2">
                <div className="space-y-2">
                  <label className="block text-xs text-muted-foreground">{t('caldav.accountName')}</label>
                  <Input
                    type="text"
                    placeholder={t('caldav.googleAccountNamePlaceholder') ?? 'Google Calendar'}
                    value={googleAccountName}
                    onChange={(e) => setGoogleAccountName(e.target.value)}
                    className="max-w-md text-sm"
                  />
                </div>
                <div className="space-y-2">
                  <label className="block text-xs text-muted-foreground">{t('caldav.googleClientId')}</label>
                  <Input
                    type="text"
                    placeholder={t('caldav.googleClientIdPlaceholder')}
                    value={googleClientId}
                    onChange={(e) => setGoogleClientId(e.target.value)}
                    className="max-w-md font-mono text-sm"
                  />
                </div>
                <div className="space-y-2">
                  <label className="block text-xs text-muted-foreground">{t('caldav.googleClientSecret')}</label>
                  <Input
                    type="password"
                    placeholder={t('caldav.googleClientSecretPlaceholder')}
                    value={googleClientSecret}
                    onChange={(e) => setGoogleClientSecret(e.target.value)}
                    className="max-w-md font-mono text-sm"
                  />
                </div>
                <div className="space-y-2">
                  <label className="block text-xs text-muted-foreground">{t('caldav.syncInterval')}</label>
                  <Input
                    type="number"
                    min={1}
                    max={1440}
                    value={googleSyncInterval}
                    onChange={(e) => setGoogleSyncInterval(e.target.value)}
                    className="w-24 text-sm"
                  />
                </div>
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    onClick={handleGoogleConnect}
                    disabled={isPending || isPollingForConnect || !googleClientId.trim() || !googleClientSecret.trim()}
                  >
                    {(createGoogleAccount.isPending || getAccountAuthUrl.isPending || isPollingForConnect) ? (
                      <HugeiconsIcon icon={Loading03Icon} size={14} strokeWidth={2} className="mr-2 animate-spin" />
                    ) : null}
                    {t('caldav.connectGoogleButton')}
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={resetAddForm}
                    disabled={isPending}
                  >
                    {t('caldav.cancelButton')}
                  </Button>
                </div>
                <details className="text-xs text-muted-foreground max-w-lg">
                  <summary className="cursor-pointer hover:text-foreground font-medium">
                    {t('caldav.googleSetupHelp')}
                  </summary>
                  <ol className="mt-2 space-y-1.5 list-none pl-0">
                    <li>{t('caldav.googleStep1')}</li>
                    <li>{t('caldav.googleStep2')}</li>
                    <li>{t('caldav.googleStep3')}</li>
                    <li>{t('caldav.googleStep4')}</li>
                    <li>{t('caldav.googleStep5')}</li>
                    <li className="pl-4 font-mono text-[11px] bg-muted/50 rounded px-2 py-1 w-fit">
                      {t('caldav.googleCallbackNote', { callbackUrl: `http://${window.location.hostname}:${backendPort.data}/api/caldav/oauth/callback` })}
                    </li>
                    <li>{t('caldav.googleStep6')}</li>
                  </ol>
                </details>
              </div>
            </TabsContent>
          </Tabs>
        </div>
      )}

      {/* Help text */}
      <details className="ml-4 sm:ml-44 text-sm text-muted-foreground">
        <summary className="cursor-pointer hover:text-foreground">{t('caldav.setupInstructions')}</summary>
        <div className="mt-2 space-y-2 text-xs">
          <p>{t('caldav.helpIntro')}</p>
          <ul className="ml-4 list-disc space-y-1">
            <li><strong>Nextcloud:</strong> https://cloud.example.com/remote.php/dav</li>
            <li><strong>Radicale:</strong> http://localhost:5232</li>
            <li><strong>Baikal:</strong> https://baikal.example.com/dav.php</li>
            <li><strong>iCloud:</strong> https://caldav.icloud.com (use app-specific password)</li>
            <li><strong>Google:</strong> Use the Google Calendar tab with OAuth2</li>
          </ul>
          <p>{t('caldav.helpNote')}</p>
        </div>
      </details>
    </div>
  )
}
