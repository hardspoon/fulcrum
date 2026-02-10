/**
 * Google Calendar Settings — per-account calendar sync configuration.
 * Used in the Calendar settings tab.
 */

import { toast } from 'sonner'
import { useTranslation } from 'react-i18next'
import { Switch } from '@/components/ui/switch'
import { Button } from '@/components/ui/button'
import { HugeiconsIcon } from '@hugeicons/react'
import { Loading03Icon, RefreshIcon, Alert02Icon } from '@hugeicons/core-free-icons'
import {
  useGoogleAccounts,
  useEnableGoogleCalendar,
  useDisableGoogleCalendar,
  useSyncGoogleCalendar,
} from '@/hooks/use-google'
import { Link } from '@tanstack/react-router'

export function GoogleCalendarSettings() {
  const { t } = useTranslation('settings')
  const { data: accounts } = useGoogleAccounts()
  const enableCalendar = useEnableGoogleCalendar()
  const disableCalendar = useDisableGoogleCalendar()
  const syncCalendar = useSyncGoogleCalendar()

  const handleToggleCalendar = async (id: string, enabled: boolean) => {
    try {
      if (enabled) {
        await enableCalendar.mutateAsync(id)
        toast.success(t('google.calendarEnabled', 'Calendar sync enabled'))
      } else {
        await disableCalendar.mutateAsync(id)
        toast.success(t('google.calendarDisabled', 'Calendar sync disabled'))
      }
    } catch (err) {
      toast.error(String(err))
    }
  }

  const handleSync = async (id: string) => {
    try {
      await syncCalendar.mutateAsync(id)
      toast.success(t('google.syncComplete', 'Calendar sync complete'))
    } catch (err) {
      toast.error(String(err))
    }
  }

  if (!accounts || accounts.length === 0) {
    return (
      <div className="space-y-2">
        <h3 className="text-sm font-medium">{t('google.calendarSync', 'Calendar Sync')}</h3>
        <p className="text-sm text-muted-foreground">
          {t('google.noAccountsCalendar', 'No Google accounts connected.')}{' '}
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
      <h3 className="text-sm font-medium">{t('google.calendarSync', 'Calendar Sync')}</h3>
      {accounts.map((account) => (
        <div key={account.id} className="border rounded-lg p-4 space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <span className="font-medium text-sm">{account.name}</span>
              {account.email && (
                <span className="text-xs text-muted-foreground ml-2">
                  {account.email}
                </span>
              )}
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => handleSync(account.id)}
                disabled={!account.calendarEnabled || syncCalendar.isPending}
                title={t('google.sync', 'Sync')}
              >
                <HugeiconsIcon
                  icon={syncCalendar.isPending ? Loading03Icon : RefreshIcon}
                  className={`h-3.5 w-3.5 ${syncCalendar.isPending ? 'animate-spin' : ''}`}
                />
              </Button>
              <Switch
                checked={account.calendarEnabled ?? false}
                onCheckedChange={(checked) =>
                  handleToggleCalendar(account.id, checked)
                }
              />
            </div>
          </div>
          {account.needsReauth && (
            <div className="flex items-start gap-1.5">
              <HugeiconsIcon icon={Alert02Icon} className="h-3.5 w-3.5 text-destructive mt-0.5" />
              <p className="text-xs text-destructive">
                {t('google.authExpiredCalendar', 'Authorization expired.')}{' '}
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
          {account.lastCalendarSyncError && !account.needsReauth && (
            <p className="text-xs text-destructive">
              {account.lastCalendarSyncError}
            </p>
          )}
          {account.lastCalendarSyncAt && !account.lastCalendarSyncError && (
            <p className="text-xs text-muted-foreground">
              {t('google.lastSync', 'Last sync')}:{' '}
              {new Date(account.lastCalendarSyncAt).toLocaleString()}
            </p>
          )}
        </div>
      ))}
    </div>
  )
}
