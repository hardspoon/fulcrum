/**
 * Google Gmail Settings — per-account Gmail enable/disable.
 * Used in the Messaging settings tab.
 */

import { toast } from 'sonner'
import { useTranslation } from 'react-i18next'
import { Switch } from '@/components/ui/switch'
import { HugeiconsIcon } from '@hugeicons/react'
import { Alert02Icon } from '@hugeicons/core-free-icons'
import {
  useGoogleAccounts,
  useEnableGmail,
  useDisableGmail,
} from '@/hooks/use-google'
import { Link } from '@tanstack/react-router'

export function GoogleGmailSettings() {
  const { t } = useTranslation('settings')
  const { data: accounts } = useGoogleAccounts()
  const enableGmail = useEnableGmail()
  const disableGmail = useDisableGmail()

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

  if (!accounts || accounts.length === 0) {
    return (
      <div className="space-y-2">
        <h3 className="text-sm font-medium">{t('google.gmail', 'Gmail')}</h3>
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
      <h3 className="text-sm font-medium">{t('google.gmail', 'Gmail')}</h3>
      {accounts.map((account) => (
        <div key={account.id} className="border rounded-lg p-4">
          <div className="flex items-center justify-between">
            <div>
              <span className="font-medium text-sm">{account.name}</span>
              {account.email && (
                <span className="text-xs text-muted-foreground ml-2">
                  {account.email}
                </span>
              )}
            </div>
            <Switch
              checked={account.gmailEnabled ?? false}
              onCheckedChange={(checked) =>
                handleToggleGmail(account.id, checked)
              }
            />
          </div>
          {account.needsReauth && (
            <div className="mt-2 flex items-start gap-1.5">
              <HugeiconsIcon icon={Alert02Icon} className="h-3.5 w-3.5 text-destructive mt-0.5" />
              <p className="text-xs text-destructive">
                {t('google.authExpiredGmail', 'Authorization expired.')}{' '}
                <Link
                  to="/settings"
                  search={{ tab: undefined }}
                  className="text-accent underline underline-offset-2"
                >
                  {t('google.reconnectInGeneral', 'Reconnect in General settings')}
                </Link>
              </p>
            </div>
          )}
          {account.lastGmailSyncError && !account.needsReauth && (
            <div className="mt-2 flex items-start gap-1.5">
              <HugeiconsIcon icon={Alert02Icon} className="h-3.5 w-3.5 text-destructive mt-0.5" />
              <p className="text-xs text-destructive">
                {account.lastGmailSyncError}
              </p>
            </div>
          )}
        </div>
      ))}
    </div>
  )
}
