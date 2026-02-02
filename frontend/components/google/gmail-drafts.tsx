/**
 * Gmail Drafts Management Component
 *
 * List, create, edit, and delete Gmail drafts.
 * Drafts must be reviewed and sent manually from Gmail UI.
 */

import { useState } from 'react'
import { toast } from 'sonner'
import { useTranslation } from 'react-i18next'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { HugeiconsIcon } from '@hugeicons/react'
import {
  Loading03Icon,
  Add01Icon,
  Delete02Icon,
  Edit02Icon,
} from '@hugeicons/core-free-icons'
import {
  useGmailDrafts,
  useCreateGmailDraft,
  useUpdateGmailDraft,
  useDeleteGmailDraft,
} from '@/hooks/use-google'

interface GmailDraftsProps {
  accountId: string
}

export function GmailDrafts({ accountId }: GmailDraftsProps) {
  const { t } = useTranslation('settings')
  const { data: drafts, isLoading } = useGmailDrafts(accountId)
  const createDraft = useCreateGmailDraft()
  const updateDraft = useUpdateGmailDraft()
  const deleteDraft = useDeleteGmailDraft()

  const [showForm, setShowForm] = useState(false)
  const [editingDraftId, setEditingDraftId] = useState<string | null>(null)
  const [to, setTo] = useState('')
  const [cc, setCc] = useState('')
  const [subject, setSubject] = useState('')
  const [body, setBody] = useState('')

  const resetForm = () => {
    setTo('')
    setCc('')
    setSubject('')
    setBody('')
    setEditingDraftId(null)
    setShowForm(false)
  }

  const handleCreate = async () => {
    try {
      const toList = to
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean)
      const ccList = cc
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean)

      await createDraft.mutateAsync({
        accountId,
        to: toList.length > 0 ? toList : undefined,
        cc: ccList.length > 0 ? ccList : undefined,
        subject: subject || undefined,
        body: body || undefined,
      })
      toast.success(t('google.draftCreated', 'Draft created'))
      resetForm()
    } catch (err) {
      toast.error(String(err))
    }
  }

  const handleUpdate = async () => {
    if (!editingDraftId) return
    try {
      const toList = to
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean)
      const ccList = cc
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean)

      await updateDraft.mutateAsync({
        accountId,
        draftId: editingDraftId,
        to: toList.length > 0 ? toList : undefined,
        cc: ccList.length > 0 ? ccList : undefined,
        subject: subject || undefined,
        body: body || undefined,
      })
      toast.success(t('google.draftUpdated', 'Draft updated'))
      resetForm()
    } catch (err) {
      toast.error(String(err))
    }
  }

  const handleDelete = async (draftId: string) => {
    try {
      await deleteDraft.mutateAsync({ accountId, draftId })
      toast.success(t('google.draftDeleted', 'Draft deleted'))
    } catch (err) {
      toast.error(String(err))
    }
  }

  const handleEdit = (draft: {
    gmailDraftId: string
    to: string[]
    cc: string[]
    subject: string | null
  }) => {
    setEditingDraftId(draft.gmailDraftId)
    setTo(draft.to.join(', '))
    setCc(draft.cc.join(', '))
    setSubject(draft.subject ?? '')
    setBody('')
    setShowForm(true)
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h4 className="text-sm font-medium">{t('google.drafts', 'Gmail Drafts')}</h4>
        <Button
          variant="outline"
          size="sm"
          onClick={() => {
            resetForm()
            setShowForm(true)
          }}
        >
          <HugeiconsIcon icon={Add01Icon} className="mr-1 h-3.5 w-3.5" />
          {t('google.newDraft', 'New Draft')}
        </Button>
      </div>

      {showForm && (
        <div className="border rounded-lg p-4 space-y-3">
          <div>
            <label className="text-xs text-muted-foreground">
              {t('google.to', 'To')}
            </label>
            <Input
              value={to}
              onChange={(e) => setTo(e.target.value)}
              placeholder="recipient@example.com"
              className="mt-1"
            />
          </div>
          <div>
            <label className="text-xs text-muted-foreground">
              {t('google.cc', 'CC')}
            </label>
            <Input
              value={cc}
              onChange={(e) => setCc(e.target.value)}
              placeholder="cc@example.com"
              className="mt-1"
            />
          </div>
          <div>
            <label className="text-xs text-muted-foreground">
              {t('google.subject', 'Subject')}
            </label>
            <Input
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              placeholder="Email subject"
              className="mt-1"
            />
          </div>
          <div>
            <label className="text-xs text-muted-foreground">
              {t('google.body', 'Body')}
            </label>
            <Textarea
              value={body}
              onChange={(e) => setBody(e.target.value)}
              placeholder="Email body"
              className="mt-1"
              rows={5}
            />
          </div>
          <div className="flex gap-2">
            <Button
              onClick={editingDraftId ? handleUpdate : handleCreate}
              disabled={createDraft.isPending || updateDraft.isPending}
              size="sm"
            >
              {(createDraft.isPending || updateDraft.isPending) && (
                <HugeiconsIcon
                  icon={Loading03Icon}
                  className="mr-1 h-3.5 w-3.5 animate-spin"
                />
              )}
              {editingDraftId
                ? t('google.updateDraft', 'Update Draft')
                : t('google.saveDraft', 'Save Draft')}
            </Button>
            <Button variant="ghost" size="sm" onClick={resetForm}>
              {t('common:buttons.cancel', 'Cancel')}
            </Button>
          </div>
        </div>
      )}

      {isLoading && (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <HugeiconsIcon icon={Loading03Icon} className="h-4 w-4 animate-spin" />
          {t('common:status.loading', 'Loading...')}
        </div>
      )}

      {drafts?.length === 0 && !isLoading && (
        <p className="text-sm text-muted-foreground">
          {t('google.noDrafts', 'No drafts.')}
        </p>
      )}

      {drafts?.map((draft) => (
        <div
          key={draft.id}
          className="border rounded-lg p-3 flex items-center justify-between"
        >
          <div className="flex-1 min-w-0">
            <div className="text-sm font-medium truncate">
              {draft.subject || t('google.noSubject', '(No Subject)')}
            </div>
            <div className="text-xs text-muted-foreground truncate">
              {draft.to.length > 0
                ? `To: ${draft.to.join(', ')}`
                : t('google.noRecipients', 'No recipients')}
            </div>
            {draft.snippet && (
              <div className="text-xs text-muted-foreground truncate mt-0.5">
                {draft.snippet}
              </div>
            )}
          </div>
          <div className="flex items-center gap-1 ml-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => handleEdit(draft)}
              title={t('google.edit', 'Edit')}
            >
              <HugeiconsIcon icon={Edit02Icon} className="h-3.5 w-3.5" />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => handleDelete(draft.gmailDraftId)}
              title={t('google.delete', 'Delete')}
            >
              <HugeiconsIcon
                icon={Delete02Icon}
                className="h-3.5 w-3.5 text-destructive"
              />
            </Button>
          </div>
        </div>
      ))}
    </div>
  )
}
