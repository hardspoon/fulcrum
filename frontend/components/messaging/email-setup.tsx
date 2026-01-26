/**
 * Email Setup Component - Configure SMTP/IMAP for email messaging channel
 */

import { useState, useEffect } from 'react'
import { toast } from 'sonner'
import { Switch } from '@/components/ui/switch'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
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
  useDisableEmail,
  useEmailSessions,
} from '@/hooks/use-messaging'

interface EmailSetupProps {
  isLoading?: boolean
}

// Provider presets for common email services
const PROVIDER_PRESETS = {
  gmail: {
    name: 'Gmail',
    smtp: { host: 'smtp.gmail.com', port: 465, secure: true },
    imap: { host: 'imap.gmail.com', port: 993, secure: true },
    note: 'Requires an App Password (not your regular password). Go to Google Account > Security > 2-Step Verification > App passwords.',
  },
  outlook: {
    name: 'Outlook / Hotmail',
    smtp: { host: 'smtp-mail.outlook.com', port: 587, secure: false },
    imap: { host: 'outlook.office365.com', port: 993, secure: true },
    note: 'May require an App Password depending on your account settings.',
  },
  custom: {
    name: 'Custom',
    smtp: { host: '', port: 465, secure: true },
    imap: { host: '', port: 993, secure: true },
    note: '',
  },
}

type ProviderKey = keyof typeof PROVIDER_PRESETS

export function EmailSetup({ isLoading = false }: EmailSetupProps) {
  const { data: status, refetch: refetchStatus } = useEmailStatus()
  const { data: sessions } = useEmailSessions()
  const configureEmail = useConfigureEmail()
  const testCredentials = useTestEmailCredentials()
  const disableEmailMutation = useDisableEmail()

  // Form state
  const [provider, setProvider] = useState<ProviderKey>('gmail')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [smtpHost, setSmtpHost] = useState('')
  const [smtpPort, setSmtpPort] = useState(465)
  const [smtpSecure, setSmtpSecure] = useState(true)
  const [imapHost, setImapHost] = useState('')
  const [imapPort, setImapPort] = useState(993)
  const [imapSecure, setImapSecure] = useState(true)
  const [pollInterval, setPollInterval] = useState(30)

  // Test results
  const [testResult, setTestResult] = useState<{
    success: boolean
    smtpOk: boolean
    imapOk: boolean
    error?: string
  } | null>(null)

  const isConnected = status?.status === 'connected'
  const isConnecting = status?.status === 'connecting'
  const isEnabled = status?.enabled ?? false

  // Initialize form from existing config
  useEffect(() => {
    if (status?.config) {
      const config = status.config
      setEmail(config.smtp?.user || '')
      setSmtpHost(config.smtp?.host || '')
      setSmtpPort(config.smtp?.port || 465)
      setSmtpSecure(config.smtp?.secure ?? true)
      setImapHost(config.imap?.host || '')
      setImapPort(config.imap?.port || 993)
      setImapSecure(config.imap?.secure ?? true)
      setPollInterval(config.pollIntervalSeconds || 30)

      // Detect provider
      if (config.smtp?.host === 'smtp.gmail.com') {
        setProvider('gmail')
      } else if (config.smtp?.host === 'smtp-mail.outlook.com') {
        setProvider('outlook')
      } else if (config.smtp?.host) {
        setProvider('custom')
      }
    }
  }, [status?.config])

  // Update server settings when provider changes
  useEffect(() => {
    if (provider !== 'custom') {
      const preset = PROVIDER_PRESETS[provider]
      setSmtpHost(preset.smtp.host)
      setSmtpPort(preset.smtp.port)
      setSmtpSecure(preset.smtp.secure)
      setImapHost(preset.imap.host)
      setImapPort(preset.imap.port)
      setImapSecure(preset.imap.secure)
    }
  }, [provider])

  const buildCredentials = () => ({
    smtp: {
      host: smtpHost,
      port: smtpPort,
      secure: smtpSecure,
      user: email,
      password,
    },
    imap: {
      host: imapHost,
      port: imapPort,
      secure: imapSecure,
      user: email,
      password,
    },
    pollIntervalSeconds: pollInterval,
  })

  const handleTest = async () => {
    setTestResult(null)
    try {
      const result = await testCredentials.mutateAsync(buildCredentials())
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
    try {
      await configureEmail.mutateAsync(buildCredentials())
      toast.success('Email configured successfully')
      setPassword('') // Clear password from form
      refetchStatus()
    } catch {
      toast.error('Failed to configure email')
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

  const isPending =
    configureEmail.isPending ||
    testCredentials.isPending ||
    disableEmailMutation.isPending

  const getStatusIcon = () => {
    if (isConnected) {
      return (
        <HugeiconsIcon
          icon={Tick02Icon}
          size={14}
          strokeWidth={2}
          className="text-green-500"
        />
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
      <HugeiconsIcon
        icon={Cancel01Icon}
        size={14}
        strokeWidth={2}
        className="text-muted-foreground"
      />
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
          Email
        </label>
        <div className="flex items-center gap-3">
          <Switch
            checked={isEnabled}
            onCheckedChange={(enabled) => {
              if (!enabled) handleDisable()
            }}
            disabled={isLoading || isPending || !isEnabled}
          />
          <span className="flex items-center gap-2 text-sm">
            {getStatusIcon()}
            <span className="text-muted-foreground">{getStatusText()}</span>
          </span>
        </div>
      </div>

      {/* Configuration form (shown when not connected) */}
      {!isConnected && (
        <div className="ml-4 sm:ml-44 space-y-4 max-w-md">
          {/* Provider selection */}
          <div className="space-y-2">
            <Label htmlFor="provider">Email Provider</Label>
            <Select
              value={provider}
              onValueChange={(value) => setProvider(value as ProviderKey)}
            >
              <SelectTrigger id="provider">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(PROVIDER_PRESETS).map(([key, preset]) => (
                  <SelectItem key={key} value={key}>
                    {preset.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {PROVIDER_PRESETS[provider].note && (
              <p className="text-xs text-muted-foreground flex items-start gap-1">
                <HugeiconsIcon
                  icon={Alert02Icon}
                  size={14}
                  strokeWidth={2}
                  className="shrink-0 mt-0.5 text-yellow-500"
                />
                {PROVIDER_PRESETS[provider].note}
              </p>
            )}
          </div>

          {/* Email address */}
          <div className="space-y-2">
            <Label htmlFor="email">Email Address</Label>
            <Input
              id="email"
              type="email"
              placeholder="your@email.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>

          {/* Password */}
          <div className="space-y-2">
            <Label htmlFor="password">
              {provider === 'gmail' ? 'App Password' : 'Password'}
            </Label>
            <Input
              id="password"
              type="password"
              placeholder={provider === 'gmail' ? '16-character app password' : 'Password'}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>

          {/* Custom server settings (only for custom provider) */}
          {provider === 'custom' && (
            <>
              <div className="border-t border-border pt-4 mt-4">
                <h4 className="text-sm font-medium mb-3">SMTP Settings (Outgoing)</h4>
                <div className="grid grid-cols-2 gap-3">
                  <div className="col-span-2 space-y-2">
                    <Label htmlFor="smtpHost">Host</Label>
                    <Input
                      id="smtpHost"
                      placeholder="smtp.example.com"
                      value={smtpHost}
                      onChange={(e) => setSmtpHost(e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="smtpPort">Port</Label>
                    <Input
                      id="smtpPort"
                      type="number"
                      value={smtpPort}
                      onChange={(e) => setSmtpPort(parseInt(e.target.value) || 465)}
                    />
                  </div>
                  <div className="flex items-end gap-2 pb-1">
                    <Switch
                      id="smtpSecure"
                      checked={smtpSecure}
                      onCheckedChange={setSmtpSecure}
                    />
                    <Label htmlFor="smtpSecure">SSL/TLS</Label>
                  </div>
                </div>
              </div>

              <div className="border-t border-border pt-4">
                <h4 className="text-sm font-medium mb-3">IMAP Settings (Incoming)</h4>
                <div className="grid grid-cols-2 gap-3">
                  <div className="col-span-2 space-y-2">
                    <Label htmlFor="imapHost">Host</Label>
                    <Input
                      id="imapHost"
                      placeholder="imap.example.com"
                      value={imapHost}
                      onChange={(e) => setImapHost(e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="imapPort">Port</Label>
                    <Input
                      id="imapPort"
                      type="number"
                      value={imapPort}
                      onChange={(e) => setImapPort(parseInt(e.target.value) || 993)}
                    />
                  </div>
                  <div className="flex items-end gap-2 pb-1">
                    <Switch
                      id="imapSecure"
                      checked={imapSecure}
                      onCheckedChange={setImapSecure}
                    />
                    <Label htmlFor="imapSecure">SSL/TLS</Label>
                  </div>
                </div>
              </div>
            </>
          )}

          {/* Poll interval */}
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

          {/* Test result */}
          {testResult && (
            <div
              className={`p-3 rounded-lg text-sm ${
                testResult.success
                  ? 'bg-green-500/10 text-green-600'
                  : 'bg-red-500/10 text-red-600'
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
                <p>
                  SMTP: {testResult.smtpOk ? 'OK' : 'Failed'}
                </p>
                <p>
                  IMAP: {testResult.imapOk ? 'OK' : 'Failed'}
                </p>
              </div>
            </div>
          )}

          {/* Action buttons */}
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={handleTest}
              disabled={isPending || !email || !password || !smtpHost || !imapHost}
            >
              {testCredentials.isPending ? (
                <HugeiconsIcon
                  icon={Loading03Icon}
                  size={14}
                  strokeWidth={2}
                  className="mr-2 animate-spin"
                />
              ) : (
                <HugeiconsIcon
                  icon={TestTube01Icon}
                  size={14}
                  strokeWidth={2}
                  className="mr-2"
                />
              )}
              Test Connection
            </Button>
            <Button
              size="sm"
              onClick={handleConfigure}
              disabled={isPending || !email || !password || !smtpHost || !imapHost}
            >
              {configureEmail.isPending ? (
                <HugeiconsIcon
                  icon={Loading03Icon}
                  size={14}
                  strokeWidth={2}
                  className="mr-2 animate-spin"
                />
              ) : null}
              Enable Email
            </Button>
          </div>
        </div>
      )}

      {/* Connected state - show sessions and disable button */}
      {isEnabled && isConnected && (
        <div className="ml-4 sm:ml-44 space-y-3">
          <Button
            variant="outline"
            size="sm"
            onClick={handleDisable}
            disabled={isPending}
          >
            Disable Email
          </Button>

          {/* Active sessions */}
          {sessions && sessions.length > 0 && (
            <div className="mt-4">
              <h4 className="text-sm font-medium text-muted-foreground mb-2">
                Active Conversations
              </h4>
              <div className="space-y-1">
                {sessions.map((session) => (
                  <div
                    key={session.id}
                    className="text-xs text-muted-foreground flex items-center gap-2"
                  >
                    <span className="font-mono">{session.channelUserId}</span>
                    {session.channelUserName && (
                      <span>({session.channelUserName})</span>
                    )}
                    <span className="text-muted-foreground/60">
                      Last: {new Date(session.lastMessageAt).toLocaleString()}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Help text */}
      <p className="ml-4 sm:ml-44 text-xs text-muted-foreground">
        Send emails to your configured address to chat with the AI assistant. Use
        /reset in the email body to start a fresh conversation.
      </p>
    </div>
  )
}
