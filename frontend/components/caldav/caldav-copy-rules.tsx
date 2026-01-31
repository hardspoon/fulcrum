/**
 * CalDAV Copy Rules Component - Manage one-way event copy rules between calendars
 */

import { useState } from 'react'
import { toast } from 'sonner'
import { useTranslation } from 'react-i18next'
import { Switch } from '@/components/ui/switch'
import { Button } from '@/components/ui/button'
import { HugeiconsIcon } from '@hugeicons/react'
import { Loading03Icon, Add01Icon, Delete02Icon, PlayIcon } from '@hugeicons/core-free-icons'
import {
  useCaldavCalendars,
  useCaldavAccounts,
  useCaldavCopyRules,
  useCreateCaldavCopyRule,
  useUpdateCaldavCopyRule,
  useDeleteCaldavCopyRule,
  useExecuteCaldavCopyRule,
} from '@/hooks/use-caldav'

interface CaldavCopyRulesProps {
  isLoading?: boolean
}

export function CaldavCopyRules({ isLoading = false }: CaldavCopyRulesProps) {
  const { t } = useTranslation('settings')
  const { data: calendars } = useCaldavCalendars()
  const { data: accounts } = useCaldavAccounts()
  const { data: rules } = useCaldavCopyRules()
  const createRule = useCreateCaldavCopyRule()
  const updateRule = useUpdateCaldavCopyRule()
  const deleteRule = useDeleteCaldavCopyRule()
  const executeRule = useExecuteCaldavCopyRule()

  const [showAddForm, setShowAddForm] = useState(false)
  const [sourceCalendarId, setSourceCalendarId] = useState('')
  const [destCalendarId, setDestCalendarId] = useState('')
  const [executingRuleId, setExecutingRuleId] = useState<string | null>(null)

  // Only show when there are 2+ calendars
  if (!calendars || calendars.length < 2) {
    return null
  }

  const accountMap = new Map((accounts ?? []).map((a) => [a.id, a]))

  // Group calendars by account for the select dropdowns
  const calendarsByAccount = new Map<string, typeof calendars>()
  for (const cal of calendars) {
    const key = cal.accountId ?? 'unknown'
    if (!calendarsByAccount.has(key)) {
      calendarsByAccount.set(key, [])
    }
    calendarsByAccount.get(key)!.push(cal)
  }

  const getCalendarName = (calendarId: string) => {
    const cal = calendars.find((c) => c.id === calendarId)
    return cal?.displayName ?? calendarId
  }

  const handleCreate = async () => {
    if (!sourceCalendarId || !destCalendarId) {
      toast.error(t('caldav.copyRulesSelectBoth'))
      return
    }
    if (sourceCalendarId === destCalendarId) {
      toast.error(t('caldav.copyRulesSameCalendar'))
      return
    }
    try {
      await createRule.mutateAsync({
        sourceCalendarId,
        destCalendarId,
      })
      setShowAddForm(false)
      setSourceCalendarId('')
      setDestCalendarId('')
      toast.success(t('caldav.copyRuleCreated'))
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t('caldav.copyRuleCreateFailed'))
    }
  }

  const handleToggle = async (ruleId: string, enabled: boolean) => {
    try {
      await updateRule.mutateAsync({ id: ruleId, enabled })
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t('caldav.copyRuleUpdateFailed'))
    }
  }

  const handleDelete = async (ruleId: string) => {
    try {
      await deleteRule.mutateAsync(ruleId)
      toast.success(t('caldav.copyRuleDeleted'))
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t('caldav.copyRuleDeleteFailed'))
    }
  }

  const handleExecute = async (ruleId: string) => {
    setExecutingRuleId(ruleId)
    try {
      const result = await executeRule.mutateAsync(ruleId)
      toast.success(
        t('caldav.copyRuleExecuted', { created: result.created, updated: result.updated })
      )
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t('caldav.copyRuleExecuteFailed'))
    } finally {
      setExecutingRuleId(null)
    }
  }

  const renderCalendarSelect = (
    value: string,
    onChange: (val: string) => void,
    id: string
  ) => (
    <select
      id={id}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="h-9 rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm focus:outline-none focus:ring-1 focus:ring-ring"
    >
      <option value="">{t('caldav.copyRulesSelectCalendar')}</option>
      {Array.from(calendarsByAccount.entries()).map(([accountId, cals]) => {
        const account = accountMap.get(accountId)
        const label = account?.name ?? accountId
        return (
          <optgroup key={accountId} label={label}>
            {cals.map((cal) => (
              <option key={cal.id} value={cal.id}>
                {cal.displayName ?? cal.id}
              </option>
            ))}
          </optgroup>
        )
      })}
    </select>
  )

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-medium">{t('caldav.copyRules')}</h3>
        {!showAddForm && (
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowAddForm(true)}
            disabled={isLoading}
          >
            <HugeiconsIcon icon={Add01Icon} size={14} strokeWidth={2} className="mr-1.5" />
            {t('caldav.addRule')}
          </Button>
        )}
      </div>

      {/* Add rule form */}
      {showAddForm && (
        <div className="rounded-md border border-border p-3 space-y-3">
          <div className="flex flex-wrap items-end gap-3">
            <div className="space-y-1">
              <label htmlFor="source-calendar" className="text-xs text-muted-foreground">
                {t('caldav.copyRulesSource')}
              </label>
              {renderCalendarSelect(sourceCalendarId, setSourceCalendarId, 'source-calendar')}
            </div>
            <span className="pb-2 text-sm text-muted-foreground">&rarr;</span>
            <div className="space-y-1">
              <label htmlFor="dest-calendar" className="text-xs text-muted-foreground">
                {t('caldav.copyRulesDest')}
              </label>
              {renderCalendarSelect(destCalendarId, setDestCalendarId, 'dest-calendar')}
            </div>
          </div>
          <div className="flex gap-2">
            <Button
              size="sm"
              onClick={handleCreate}
              disabled={createRule.isPending || !sourceCalendarId || !destCalendarId}
            >
              {createRule.isPending && (
                <HugeiconsIcon
                  icon={Loading03Icon}
                  size={14}
                  strokeWidth={2}
                  className="mr-1.5 animate-spin"
                />
              )}
              {t('caldav.addRule')}
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setShowAddForm(false)
                setSourceCalendarId('')
                setDestCalendarId('')
              }}
              disabled={createRule.isPending}
            >
              {t('caldav.cancelButton')}
            </Button>
          </div>
        </div>
      )}

      {/* Rules list */}
      {rules && rules.length > 0 ? (
        <div className="space-y-2">
          {rules.map((rule) => {
            const isExecuting = executingRuleId === rule.id
            return (
              <div
                key={rule.id}
                className="flex items-center gap-3 rounded-md border border-border px-3 py-2"
              >
                <Switch
                  checked={rule.enabled !== false}
                  onCheckedChange={(checked) => handleToggle(rule.id, checked)}
                  disabled={updateRule.isPending}
                />
                <div className="flex-1 min-w-0">
                  <span className="text-sm">
                    {getCalendarName(rule.sourceCalendarId)}
                    <span className="mx-1.5 text-muted-foreground">&rarr;</span>
                    {getCalendarName(rule.destCalendarId)}
                  </span>
                  {rule.lastExecutedAt && (
                    <p className="text-xs text-muted-foreground">
                      {t('caldav.copyRulesLastRun', {
                        time: new Date(rule.lastExecutedAt).toLocaleString(),
                      })}
                    </p>
                  )}
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleExecute(rule.id)}
                  disabled={isExecuting || isLoading}
                  title={t('caldav.copyRulesRunNow')}
                >
                  {isExecuting ? (
                    <HugeiconsIcon
                      icon={Loading03Icon}
                      size={14}
                      strokeWidth={2}
                      className="animate-spin"
                    />
                  ) : (
                    <HugeiconsIcon icon={PlayIcon} size={14} strokeWidth={2} />
                  )}
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => handleDelete(rule.id)}
                  disabled={deleteRule.isPending || isLoading}
                  title={t('caldav.copyRulesDelete')}
                >
                  <HugeiconsIcon
                    icon={Delete02Icon}
                    size={14}
                    strokeWidth={2}
                    className="text-destructive"
                  />
                </Button>
              </div>
            )
          })}
        </div>
      ) : (
        <p className="text-xs text-muted-foreground">{t('caldav.copyRulesEmpty')}</p>
      )}
    </div>
  )
}
