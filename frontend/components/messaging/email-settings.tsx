/**
 * Unified Email Settings — IMAP and Gmail API backends under one roof.
 *
 * Replaces the old standalone EmailSetup (IMAP-only) and GoogleGmailSettings
 * components with a single section that lets users pick their email backend.
 */

import { useState, useEffect } from 'react'
import { toast } from 'sonner'
import { useTranslation } from 'react-i18next'
import { Switch } from '@/components/ui/switch'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { HugeiconsIcon } from '@hugeicons/react'
import {
  Loading03Icon,
  Tick02Icon,
  Cancel01Icon,
  TestTube01Icon,
  Alert02Icon,
} from '@hugeicons/core-free-icons'
import {
  useEmailStatus,
  useConfigureEmail,
  useTestEmailCredentials,
  useEnableEmail,
  useDisableEmail,
} from '@/hooks/use-messaging'
import {
  useGoogleAccounts,
  useEnableGmail,
  useDisableGmail,
  useUpdateGoogleAccount,
} from '@/hooks/use-google'
import type { GoogleAccount } from '@/hooks/use-google'
import { useConfig, useUpdateConfig } from '@/hooks/use-config'
import { CONFIG_KEYS } from '../../../shared/config-keys'
import { Link } from '@tanstack/react-router'

interface EmailSettingsProps {
  isLoading?: boolean
}

// Well-known email provider IMAP settings (auto-detected from email domain)
const KNOWN_PROVIDERS: Record<
  string,
  {
    imap: { host: string; port: number; secure: boolean }
    note?: string
  }
> = {
  'gmail.com': {
    imap: { host: 'imap.gmail.com', port: 993, secure: true },
    note: 'Requires an App Password. Go to Google Account > Security > 2-Step Verification > App passwords.',
  },
  'googlemail.com': {
    imap: { host: 'imap.gmail.com', port: 993, secure: true },
    note: 'Requires an App Password. Go to Google Account > Security > 2-Step Verification > App passwords.',
  },
  'outlook.com': {
    imap: { host: 'outlook.office365.com', port: 993, secure: true },
  },
  'hotmail.com': {
    imap: { host: 'outlook.office365.com', port: 993, secure: true },
  },
  'live.com': {
    imap: { host: 'outlook.office365.com', port: 993, secure: true },
  },
  'yahoo.com': {
    imap: { host: 'imap.mail.yahoo.com', port: 993, secure: true },
  },
  'icloud.com': {
    imap: { host: 'imap.mail.me.com', port: 993, secure: true },
    note: 'Requires an App-Specific Password from appleid.apple.com.',
  },
}

function getProviderSettings(email: string) {
  const domain = email.split('@')[1]?.toLowerCase()
  if (domain && KNOWN_PROVIDERS[domain]) {
    return { ...KNOWN_PROVIDERS[domain], isKnown: true }
  }
  return {
    imap: { host: `imap.${domain || 'example.com'}`, port: 993, secure: true },
    isKnown: false,
  }
}

type EmailBackend = 'imap' | 'gmail'

export function EmailSettings({ isLoading = false }: EmailSettingsProps) {
  const { t } = useTranslation('settings')
  const [backend, setBackend] = useState<EmailBackend>('gmail')

  return (
    <div className="space-y-4">
      {/* Backend selector */}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <label className="text-sm text-muted-foreground sm:w-40 sm:shrink-0">
          {t('imap.emailBackend', 'Email Backend')}
        </label>
        <div className="flex gap-1 rounded-lg border p-0.5">
          <button
            type="button"
            onClick={() => setBackend('gmail')}
            className={`rounded-md px-3 py-1 text-sm transition-colors ${
              backend === 'gmail'
                ? 'bg-destructive text-destructive-foreground'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            {t('google.gmail', 'Gmail API')}
          </button>
          <button
            type="button"
            onClick={() => setBackend('imap')}
            className={`rounded-md px-3 py-1 text-sm transition-colors ${
              backend === 'imap'
                ? 'bg-destructive text-destructive-foreground'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            IMAP
          </button>
        </div>
      </div>

      {backend === 'imap' ? (
        <ImapSettings isLoading={isLoading} />
      ) : (
        <GmailSettings />
      )}
    </div>
  )
}

// ─── IMAP Settings ──────────────────────────────────────────────────────────

function ImapSettings({ isLoading = false }: { isLoading?: boolean }) {
  const { t } = useTranslation('settings')
  const { data: status, refetch: refetchStatus } = useEmailStatus()
  const configureEmail = useConfigureEmail()
  const testCredentials = useTestEmailCredentials()
  const enableEmailMutation = useEnableEmail()
  const disableEmailMutation = useDisableEmail()

  const hasCredentials = !!status?.config?.imap?.host

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showAdvanced, setShowAdvanced] = useState(false)
  const [imapHost, setImapHost] = useState('')
  const [imapPort, setImapPort] = useState(993)
  const [imapSecure, setImapSecure] = useState(true)
  const [imapUser, setImapUser] = useState('')
  const [imapPassword, setImapPassword] = useState('')
  const [pollInterval, setPollInterval] = useState(30)

  const [testResult, setTestResult] = useState<{
    success: boolean
    imapOk: boolean
    error?: string
  } | null>(null)

  const isConnected = status?.status === 'connected'
  const isConnecting = status?.status === 'connecting'
  const isEnabled = status?.enabled ?? false

  const providerInfo = getProviderSettings(email)

  useEffect(() => {
    if (status?.config) {
      const config = status.config
      setEmail(config.imap?.user || '')
      setPassword(config.imap?.password || '')
      setImapHost(config.imap?.host || '')
      setImapPort(config.imap?.port || 993)
      setImapSecure(config.imap?.secure ?? true)
      setImapUser(config.imap?.user || '')
      setImapPassword(config.imap?.password || '')
      setPollInterval(config.pollIntervalSeconds || 30)
      const detected = getProviderSettings(config.imap?.user || '')
      if (config.imap?.host && config.imap.host !== detected.imap.host) {
        setShowAdvanced(true)
      }
    }
  }, [status?.config])

  const buildCredentials = () => {
    if (showAdvanced) {
      return {
        imap: {
          host: imapHost,
          port: imapPort,
          secure: imapSecure,
          user: imapUser,
          password: imapPassword,
        },
        pollIntervalSeconds: pollInterval,
      }
    }

    return {
      imap: {
        ...providerInfo.imap,
        user: email,
        password,
      },
      pollIntervalSeconds: pollInterval,
    }
  }

  const handleTest = async () => {
    const creds = buildCredentials()
    setTestResult(null)
    try {
      const result = await testCredentials.mutateAsync(creds)
      setTestResult(result)
      if (result.success) {
        toast.success('Connection test successful')
      } else {
        toast.error(result.error || 'Connection test failed')
      }
    } catch {
      toast.error('Failed to test credentials')
    }
  }

  const handleConfigure = async () => {
    const creds = buildCredentials()
    try {
      await configureEmail.mutateAsync(creds)
      toast.success('Email configured successfully')
      setPassword('')
      refetchStatus()
    } catch {
      toast.error('Failed to configure email')
    }
  }

  const handleEnable = async () => {
    try {
      const result = await enableEmailMutation.mutateAsync()
      if (result) {
        toast.success('Email enabled')
        refetchStatus()
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to enable email')
    }
  }

  const handleDisable = async () => {
    try {
      await disableEmailMutation.mutateAsync()
      toast.success('Email disabled')
      refetchStatus()
    } catch {
      toast.error('Failed to disable email')
    }
  }

  const handleToggle = async (enabled: boolean) => {
    if (enabled) {
      if (hasCredentials) {
        await handleEnable()
      }
    } else {
      await handleDisable()
    }
  }

  const isPending =
    configureEmail.isPending ||
    testCredentials.isPending ||
    enableEmailMutation.isPending ||
    disableEmailMutation.isPending

  const getStatusIcon = () => {
    if (isConnected) {
      return (
        <HugeiconsIcon icon={Tick02Icon} size={14} strokeWidth={2} className="text-green-500" />
      )
    }
    if (isConnecting) {
      return (
        <HugeiconsIcon
          icon={Loading03Icon}
          size={14}
          strokeWidth={2}
          className="animate-spin text-yellow-500"
        />
      )
    }
    return (
      <HugeiconsIcon icon={Cancel01Icon} size={14} strokeWidth={2} className="text-muted-foreground" />
    )
  }

  const getStatusText = () => {
    if (isConnected) {
      return status?.displayName ? `Connected as ${status.displayName}` : 'Connected'
    }
    if (isConnecting) return 'Connecting...'
    if (status?.status === 'credentials_required') return 'Credentials required'
    return 'Disconnected'
  }

  return (
    <div className="space-y-4">
      {/* Enable toggle and status */}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <label className="text-sm text-muted-foreground sm:w-40 sm:shrink-0">
          {t('imap.label', 'IMAP Feed')}
        </label>
        <div className="flex items-center gap-3">
          <Switch checked={isEnabled} onCheckedChange={handleToggle} disabled={isLoading || isPending} />
          <span className="flex items-center gap-2 text-sm">
            {getStatusIcon()}
            <span className="text-muted-foreground">{getStatusText()}</span>
          </span>
        </div>
      </div>

      {/* Configuration form (shown when not connected) */}
      {!isConnected && (
        <div className="ml-4 sm:ml-44 space-y-4 max-w-md">
          {!showAdvanced && (
            <>
              <div className="space-y-2">
                <Label htmlFor="email">Email Address</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="assistant@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
                {providerInfo.note && email.includes('@') && (
                  <p className="text-xs text-muted-foreground flex items-start gap-1">
                    <HugeiconsIcon
                      icon={Alert02Icon}
                      size={14}
                      strokeWidth={2}
                      className="shrink-0 mt-0.5 text-yellow-500"
                    />
                    {providerInfo.note}
                  </p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="password">
                  {email.includes('@gmail.com') || email.includes('@icloud.com')
                    ? 'App Password'
                    : 'Password'}
                </Label>
                <Input
                  id="password"
                  type="password"
                  placeholder="Password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
              </div>

              {email.includes('@') && (
                <div className="text-xs text-muted-foreground">
                  <span>
                    IMAP: {providerInfo.imap.host}:{providerInfo.imap.port}
                  </span>
                  {!providerInfo.isKnown && (
                    <span className="ml-2 text-yellow-600">(auto-detected)</span>
                  )}
                </div>
              )}
            </>
          )}

          {/* Advanced settings toggle */}
          <div className="pt-2">
            <button
              type="button"
              onClick={() => setShowAdvanced(!showAdvanced)}
              className="text-xs text-muted-foreground hover:text-foreground"
            >
              {showAdvanced ? '- Hide advanced settings' : '+ Show advanced settings'}
            </button>
          </div>

          {showAdvanced && (
            <>
              <div className="border-t border-border pt-4">
                <h4 className="text-sm font-medium mb-3">IMAP Settings (Incoming)</h4>
                <div className="space-y-3">
                  <div className="grid grid-cols-2 gap-3">
                    <div className="col-span-2 space-y-2">
                      <Label htmlFor="imapHost">Host</Label>
                      <Input
                        id="imapHost"
                        placeholder="imap.gmail.com"
                        value={imapHost}
                        onChange={(e) => setImapHost(e.target.value)}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="imapPort">Port</Label>
                      <Input
                        id="imapPort"
                        type="number"
                        value={imapPort || providerInfo.imap.port}
                        onChange={(e) => setImapPort(parseInt(e.target.value) || 993)}
                      />
                    </div>
                    <div className="flex items-end gap-2 pb-1">
                      <Switch id="imapSecure" checked={imapSecure} onCheckedChange={setImapSecure} />
                      <Label htmlFor="imapSecure">SSL/TLS</Label>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="imapUser">Username</Label>
                    <Input
                      id="imapUser"
                      placeholder="you@gmail.com"
                      value={imapUser}
                      onChange={(e) => setImapUser(e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="imapPassword">Password</Label>
                    <Input
                      id="imapPassword"
                      type="password"
                      placeholder="IMAP password or app password"
                      value={imapPassword}
                      onChange={(e) => setImapPassword(e.target.value)}
                    />
                  </div>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="pollInterval">Check for new emails every</Label>
                <div className="flex items-center gap-2">
                  <Input
                    id="pollInterval"
                    type="number"
                    className="w-20"
                    min={10}
                    max={300}
                    value={pollInterval}
                    onChange={(e) => setPollInterval(parseInt(e.target.value) || 30)}
                  />
                  <span className="text-sm text-muted-foreground">seconds</span>
                </div>
              </div>
            </>
          )}

          {/* Test result */}
          {testResult && (
            <div
              className={`p-3 rounded-lg text-sm ${
                testResult.success ? 'bg-green-500/10 text-green-600' : 'bg-red-500/10 text-red-600'
              }`}
            >
              <div className="flex items-center gap-2">
                <HugeiconsIcon
                  icon={testResult.success ? Tick02Icon : Cancel01Icon}
                  size={16}
                  strokeWidth={2}
                />
                <span>{testResult.success ? 'Connection successful' : 'Connection failed'}</span>
              </div>
              {!testResult.success && testResult.error && (
                <p className="mt-1 text-xs">{testResult.error}</p>
              )}
              <div className="mt-2 text-xs space-y-1">
                <p>IMAP: {testResult.imapOk ? 'OK' : 'Failed'}</p>
              </div>
            </div>
          )}

          {/* Action buttons */}
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={handleTest}
              disabled={
                isPending ||
                (showAdvanced ? !imapHost || !imapUser || !imapPassword : !email || !password)
              }
            >
              {testCredentials.isPending ? (
                <HugeiconsIcon
                  icon={Loading03Icon}
                  size={14}
                  strokeWidth={2}
                  className="mr-2 animate-spin"
                />
              ) : (
                <HugeiconsIcon icon={TestTube01Icon} size={14} strokeWidth={2} className="mr-2" />
              )}
              Test Connection
            </Button>
            <Button
              size="sm"
              onClick={handleConfigure}
              disabled={
                isPending ||
                (showAdvanced ? !imapHost || !imapUser || !imapPassword : !email || !password)
              }
            >
              {configureEmail.isPending ? (
                <HugeiconsIcon
                  icon={Loading03Icon}
                  size={14}
                  strokeWidth={2}
                  className="mr-2 animate-spin"
                />
              ) : null}
              Save & Enable
            </Button>
          </div>
        </div>
      )}

      {/* Connected state */}
      {isEnabled && isConnected && (
        <div className="ml-4 sm:ml-44 space-y-3">
          <Button variant="outline" size="sm" onClick={handleDisable} disabled={isPending}>
            {t('imap.disableButton', 'Disable Email')}
          </Button>
        </div>
      )}

      <p className="ml-4 sm:ml-44 text-xs text-muted-foreground">
        {t('imap.description', 'Monitor an IMAP mailbox as a read-only feed. Incoming emails appear in the messaging timeline but no replies are sent.')}
      </p>
    </div>
  )
}

// ─── Gmail API Settings ─────────────────────────────────────────────────────

function GmailSettings() {
  const { t } = useTranslation('settings')
  const { data: accounts } = useGoogleAccounts()
  const enableGmail = useEnableGmail()
  const disableGmail = useDisableGmail()
  const pollIntervalQuery = useConfig(CONFIG_KEYS.EMAIL_POLL_INTERVAL)
  const updateConfig = useUpdateConfig()
  const [pollInterval, setPollInterval] = useState(30)

  // Sync poll interval from settings
  useEffect(() => {
    if (pollIntervalQuery.data?.value != null) {
      setPollInterval(Number(pollIntervalQuery.data.value) || 30)
    }
  }, [pollIntervalQuery.data?.value])

  const handlePollIntervalBlur = () => {
    const clamped = Math.max(5, Math.min(3600, pollInterval || 30))
    setPollInterval(clamped)
    updateConfig.mutate({ key: CONFIG_KEYS.EMAIL_POLL_INTERVAL, value: clamped })
  }

  const handleToggleGmail = async (id: string, enabled: boolean) => {
    try {
      if (enabled) {
        await enableGmail.mutateAsync(id)
        toast.success(t('google.gmailEnabled', 'Gmail enabled'))
      } else {
        await disableGmail.mutateAsync(id)
        toast.success(t('google.gmailDisabled', 'Gmail disabled'))
      }
    } catch (err) {
      toast.error(String(err))
    }
  }

  const hasEnabledAccount = accounts?.some((a) => a.gmailEnabled)

  if (!accounts || accounts.length === 0) {
    return (
      <div className="space-y-2 ml-4 sm:ml-44">
        <p className="text-sm text-muted-foreground">
          {t('google.noAccountsGmail', 'No Google accounts connected.')}{' '}
          <Link
            to="/settings"
            search={{ tab: undefined }}
            className="text-accent underline underline-offset-2"
          >
            {t('google.addInGeneral', 'Add one in General settings')}
          </Link>
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {accounts.map((account) => (
        <GmailAccountCard
          key={account.id}
          account={account}
          onToggle={handleToggleGmail}
        />
      ))}

      {hasEnabledAccount && (
        <div className="flex items-center gap-2 ml-4">
          <Label htmlFor="gmailPollInterval">{t('imap.checkEvery', 'Check for new emails every')}</Label>
          <Input
            id="gmailPollInterval"
            type="number"
            min={5}
            max={3600}
            value={pollInterval}
            onChange={(e) => setPollInterval(parseInt(e.target.value) || 30)}
            onBlur={handlePollIntervalBlur}
            onKeyDown={(e) => { if (e.key === 'Enter') e.currentTarget.blur() }}
            className="w-20 h-8"
          />
          <span className="text-sm text-muted-foreground">{t('imap.seconds', 'seconds')}</span>
        </div>
      )}

      <p className="text-xs text-muted-foreground">
        {t('google.gmailDescription', 'Gmail API uses OAuth2 — no app passwords needed. Drafts are created for human review before sending.')}
      </p>
    </div>
  )
}

function GmailAccountCard({
  account,
  onToggle,
}: {
  account: GoogleAccount
  onToggle: (id: string, enabled: boolean) => void
}) {
  const { t } = useTranslation('settings')
  const updateAccount = useUpdateGoogleAccount()
  const [sendAs, setSendAs] = useState(account.sendAsEmail ?? account.email ?? '')

  const handleSendAsBlur = async () => {
    const value = sendAs.trim()
    const current = account.sendAsEmail ?? account.email ?? ''
    if (value === current) return
    try {
      await updateAccount.mutateAsync({
        id: account.id,
        sendAsEmail: value || null,
      })
      toast.success(t('google.sendAsUpdated', 'Send-as address updated'))
    } catch (err) {
      toast.error(String(err))
    }
  }

  return (
    <div className="border rounded-lg p-4 space-y-3">
      <div className="flex items-center justify-between">
        <div>
          <span className="font-medium text-sm">{account.name}</span>
          {account.email && (
            <span className="text-xs text-muted-foreground ml-2">{account.email}</span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground">{t('google.monitorInbox', 'Monitor inbox')}</span>
          <Switch
            checked={account.gmailEnabled ?? false}
            onCheckedChange={(checked) => onToggle(account.id, checked)}
          />
        </div>
      </div>

      {account.gmailEnabled && (
        <div className="flex items-center gap-2">
          <label className="text-xs text-muted-foreground shrink-0">{t('google.sendAs', 'Send as')}</label>
          <Input
            value={sendAs}
            onChange={(e) => setSendAs(e.target.value)}
            onBlur={handleSendAsBlur}
            onKeyDown={(e) => { if (e.key === 'Enter') e.currentTarget.blur() }}
            placeholder={account.email ?? t('google.sendAsPlaceholder', 'you@gmail.com')}
            className="h-8 text-xs max-w-xs"
          />
          <span className="text-xs text-muted-foreground">{t('google.draftsOnly', '(drafts only)')}</span>
        </div>
      )}

      {account.lastGmailSyncError && (
        <div className="flex items-start gap-1.5">
          <HugeiconsIcon icon={Alert02Icon} className="h-3.5 w-3.5 text-destructive mt-0.5" />
          <p className="text-xs text-destructive">{account.lastGmailSyncError}</p>
        </div>
      )}
    </div>
  )
}
