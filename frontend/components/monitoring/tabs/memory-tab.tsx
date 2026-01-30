import { useState, useMemo, useRef, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { HugeiconsIcon } from '@hugeicons/react'
import {
  Loading03Icon,
  Alert02Icon,
  Delete02Icon,
  Search01Icon,
  PencilEdit01Icon,
  CheckmarkCircle02Icon,
  Cancel01Icon,
} from '@hugeicons/core-free-icons'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { useMemories, useSearchMemories, useDeleteMemory, useUpdateMemory } from '@/hooks/use-memories'
import type { Memory } from '@/hooks/use-memories'

function formatSource(source: string): string {
  const parts = source.split(':')
  if (parts.length === 2) {
    return parts[1].charAt(0).toUpperCase() + parts[1].slice(1)
  }
  return source
}

function formatRelativeTime(dateStr: string): string {
  const date = new Date(dateStr)
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()

  const diffMins = Math.floor(diffMs / 60000)
  const diffHours = Math.floor(diffMins / 60)
  const diffDays = Math.floor(diffHours / 24)

  if (diffMins < 1) return 'just now'
  if (diffMins < 60) return `${diffMins}m ago`
  if (diffHours < 24) return `${diffHours}h ago`
  if (diffDays < 7) return `${diffDays}d ago`
  return date.toLocaleDateString()
}

function MemoryRow({
  memory,
  onDelete,
  onUpdate,
}: {
  memory: Memory
  onDelete: (id: string) => void
  onUpdate: (id: string, content: string, tags: string[] | null) => void
}) {
  const { t } = useTranslation('monitoring')
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [editing, setEditing] = useState(false)
  const [editContent, setEditContent] = useState(memory.content)
  const [editTags, setEditTags] = useState(memory.tags?.join(', ') ?? '')
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    if (editing && textareaRef.current) {
      textareaRef.current.focus()
      textareaRef.current.setSelectionRange(textareaRef.current.value.length, textareaRef.current.value.length)
    }
  }, [editing])

  const handleDelete = () => {
    if (confirmDelete) {
      onDelete(memory.id)
      setConfirmDelete(false)
    } else {
      setConfirmDelete(true)
      setTimeout(() => setConfirmDelete(false), 3000)
    }
  }

  const handleEdit = () => {
    setEditContent(memory.content)
    setEditTags(memory.tags?.join(', ') ?? '')
    setEditing(true)
  }

  const handleSave = () => {
    const trimmed = editContent.trim()
    if (!trimmed) return
    const tags = editTags
      .split(',')
      .map((t) => t.trim())
      .filter(Boolean)
    onUpdate(memory.id, trimmed, tags.length > 0 ? tags : null)
    setEditing(false)
  }

  const handleCancel = () => {
    setEditing(false)
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') handleCancel()
    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) handleSave()
  }

  if (editing) {
    return (
      <div className="p-3 border-b last:border-b-0 space-y-2 bg-muted/30">
        <Textarea
          ref={textareaRef}
          value={editContent}
          onChange={(e) => setEditContent(e.target.value)}
          onKeyDown={handleKeyDown}
          className="min-h-[60px] text-sm"
          rows={3}
        />
        <div className="flex items-center gap-2">
          <Input
            value={editTags}
            onChange={(e) => setEditTags(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={t('memory.tagsPlaceholder')}
            className="h-7 text-xs flex-1"
          />
          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={handleCancel}>
            <HugeiconsIcon icon={Cancel01Icon} size={14} strokeWidth={2} />
          </Button>
          <Button variant="ghost" size="icon" className="h-7 w-7 text-green-600" onClick={handleSave}>
            <HugeiconsIcon icon={CheckmarkCircle02Icon} size={14} strokeWidth={2} />
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className="flex items-start gap-3 p-3 border-b last:border-b-0 hover:bg-muted/50 transition-colors">
      <div className="flex-1 min-w-0">
        <div className="text-sm whitespace-pre-wrap break-words">{memory.content}</div>
        <div className="flex items-center gap-2 mt-1.5 flex-wrap">
          {memory.tags?.map((tag) => (
            <Badge key={tag} variant="secondary" className="text-xs">
              {tag}
            </Badge>
          ))}
          {memory.source && (
            <span className="text-xs text-muted-foreground">{formatSource(memory.source)}</span>
          )}
          <span className="text-xs text-muted-foreground">{formatRelativeTime(memory.createdAt)}</span>
        </div>
      </div>
      <div className="flex items-center gap-0.5 shrink-0">
        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={handleEdit}>
          <HugeiconsIcon icon={PencilEdit01Icon} size={14} strokeWidth={2} />
        </Button>
        <Button
          variant={confirmDelete ? 'destructive' : 'ghost'}
          size="icon"
          className="h-7 w-7"
          onClick={handleDelete}
          title={confirmDelete ? t('memory.deleteConfirm') : undefined}
        >
          <HugeiconsIcon icon={Delete02Icon} size={14} strokeWidth={2} />
        </Button>
      </div>
    </div>
  )
}

export default function MemoryTab() {
  const { t } = useTranslation('monitoring')
  const [searchQuery, setSearchQuery] = useState('')
  const [debouncedQuery, setDebouncedQuery] = useState('')
  const [debounceTimer, setDebounceTimer] = useState<ReturnType<typeof setTimeout> | null>(null)

  const isSearching = debouncedQuery.trim().length > 0

  const { data: listData, isLoading: listLoading, error: listError } = useMemories({ limit: 50 })
  const { data: searchData, isLoading: searchLoading, error: searchError } = useSearchMemories(debouncedQuery, { limit: 50 })
  const deleteMutation = useDeleteMemory()
  const updateMutation = useUpdateMemory()

  const handleSearchChange = (value: string) => {
    setSearchQuery(value)
    if (debounceTimer) clearTimeout(debounceTimer)
    const timer = setTimeout(() => setDebouncedQuery(value), 300)
    setDebounceTimer(timer)
  }

  const handleUpdate = (id: string, content: string, tags: string[] | null) => {
    updateMutation.mutate({ id, content, tags: tags ?? undefined })
  }

  const memories = isSearching ? searchData : listData?.memories
  const isLoading = isSearching ? searchLoading : listLoading
  const error = isSearching ? searchError : listError

  // Collect unique tags across all memories for stats
  const uniqueTags = useMemo(() => {
    if (!listData?.memories) return 0
    const tags = new Set<string>()
    for (const m of listData.memories) {
      m.tags?.forEach((tag) => tags.add(tag))
    }
    return tags.size
  }, [listData?.memories])

  return (
    <div className="space-y-6">
      {/* Stats */}
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-2 max-w-md">
        <Card>
          <CardContent className="py-3 px-4">
            <div className="text-2xl font-semibold tabular-nums">{listData?.total ?? '-'}</div>
            <div className="text-xs text-muted-foreground">{t('memory.total', { count: listData?.total ?? 0 })}</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="py-3 px-4">
            <div className="text-2xl font-semibold tabular-nums">{uniqueTags}</div>
            <div className="text-xs text-muted-foreground">Unique tags</div>
          </CardContent>
        </Card>
      </div>

      {/* Search + Memory List */}
      <Card>
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between gap-3">
            <CardTitle className="text-base font-medium">{t('memory.title')}</CardTitle>
            <div className="relative w-64">
              <HugeiconsIcon icon={Search01Icon} size={14} strokeWidth={2} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={searchQuery}
                onChange={(e) => handleSearchChange(e.target.value)}
                placeholder={t('memory.search')}
                className="pl-8 h-8 text-sm"
              />
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {isLoading && (
            <div className="flex items-center justify-center py-12">
              <HugeiconsIcon icon={Loading03Icon} size={24} strokeWidth={2} className="animate-spin text-muted-foreground" />
            </div>
          )}

          {error && (
            <div className="flex items-center gap-3 py-6 px-4 text-destructive">
              <HugeiconsIcon icon={Alert02Icon} size={20} strokeWidth={2} />
              <span className="text-sm">{error.message}</span>
            </div>
          )}

          {!isLoading && !error && memories && memories.length > 0 && (
            <div className="divide-y">
              {memories.map((memory) => (
                <MemoryRow
                  key={memory.id}
                  memory={memory}
                  onDelete={(id) => deleteMutation.mutate(id)}
                  onUpdate={handleUpdate}
                />
              ))}
            </div>
          )}

          {!isLoading && !error && (!memories || memories.length === 0) && (
            <div className="py-8 text-center text-sm text-muted-foreground">
              {isSearching ? t('memory.noResults') : t('memory.empty')}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
