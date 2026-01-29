import { useState } from 'react'
import { HugeiconsIcon } from '@hugeicons/react'
import {
  Loading03Icon,
  Alert02Icon,
  FilterIcon,
  Mail01Icon,
  MessageMultiple01Icon,
  ArrowDown01Icon,
  ArrowUp01Icon,
  WhatsappIcon,
  DiscordIcon,
  TelegramIcon,
  SlackIcon,
  Search01Icon,
  SentIcon,
  ArrowDownLeftIcon,
  ArrowUpRightIcon,
} from '@hugeicons/core-free-icons'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select'
import { Collapsible, CollapsibleTrigger, CollapsibleContent } from '@/components/ui/collapsible'
import { useChannelMessages, useChannelMessageCounts, type ChannelMessage, type ChannelType } from '@/hooks/use-channel-messages'

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

function getChannelIcon(channel: ChannelType) {
  switch (channel) {
    case 'email':
      return Mail01Icon
    case 'whatsapp':
      return WhatsappIcon
    case 'discord':
      return DiscordIcon
    case 'telegram':
      return TelegramIcon
    case 'slack':
      return SlackIcon
    default:
      return MessageMultiple01Icon
  }
}

function getChannelColor(channel: ChannelType): string {
  switch (channel) {
    case 'email':
      return 'text-blue-500'
    case 'whatsapp':
      return 'text-green-500'
    case 'discord':
      return 'text-indigo-500'
    case 'telegram':
      return 'text-sky-500'
    case 'slack':
      return 'text-purple-500'
    default:
      return 'text-muted-foreground'
  }
}

function StatCard({ label, value, icon, className }: { label: string; value: number; icon: typeof Mail01Icon; className?: string }) {
  return (
    <Card className={className}>
      <CardContent className="py-3 px-4 flex items-center gap-3">
        <HugeiconsIcon icon={icon} size={18} strokeWidth={2} className="text-muted-foreground" />
        <div>
          <div className="text-xl font-semibold tabular-nums">{value}</div>
          <div className="text-xs text-muted-foreground capitalize">{label}</div>
        </div>
      </CardContent>
    </Card>
  )
}

function MessageRow({ message }: { message: ChannelMessage }) {
  const [isOpen, setIsOpen] = useState(false)
  const ChannelIcon = getChannelIcon(message.channelType)
  const channelColor = getChannelColor(message.channelType)

  const metadata = message.metadata as Record<string, unknown> | null
  const subject = metadata?.subject as string | undefined
  const isEmail = message.channelType === 'email'

  // Truncate content for preview
  const contentPreview = message.content.length > 100
    ? `${message.content.slice(0, 100)}...`
    : message.content

  const hasLongContent = message.content.length > 100

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen}>
      <CollapsibleTrigger asChild disabled={!hasLongContent}>
        <div className={`flex items-start gap-3 p-3 border-b last:border-b-0 ${hasLongContent ? 'cursor-pointer hover:bg-muted/50' : ''} transition-colors`}>
          <div className="mt-0.5 shrink-0">
            <HugeiconsIcon icon={ChannelIcon} size={16} strokeWidth={2} className={channelColor} />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <Badge
                variant={message.direction === 'incoming' ? 'secondary' : 'outline'}
                className="text-xs gap-1"
              >
                <HugeiconsIcon
                  icon={message.direction === 'incoming' ? ArrowDownLeftIcon : ArrowUpRightIcon}
                  size={10}
                  strokeWidth={2}
                />
                {message.direction}
              </Badge>
              {isEmail && subject && (
                <span className="text-sm font-medium truncate">{subject}</span>
              )}
            </div>
            <div className="mt-1 text-sm text-foreground/80">
              {hasLongContent && isOpen ? null : contentPreview}
            </div>
            <div className="flex items-center gap-3 mt-1.5 text-xs text-muted-foreground flex-wrap">
              <span className="capitalize">{message.channelType}</span>
              <span className="truncate max-w-[200px]">
                {message.direction === 'incoming'
                  ? `From: ${message.senderName || message.senderId}`
                  : `To: ${message.recipientId || 'unknown'}`}
              </span>
              <span>{formatRelativeTime(message.messageTimestamp)}</span>
            </div>
          </div>
          {hasLongContent && (
            <HugeiconsIcon
              icon={isOpen ? ArrowUp01Icon : ArrowDown01Icon}
              size={14}
              strokeWidth={2}
              className="text-muted-foreground shrink-0 mt-1"
            />
          )}
        </div>
      </CollapsibleTrigger>
      {hasLongContent && (
        <CollapsibleContent>
          <div className="px-3 pb-3 pt-0 pl-10 border-b last:border-b-0 bg-muted/30">
            <pre className="text-sm whitespace-pre-wrap break-words font-sans">{message.content}</pre>
          </div>
        </CollapsibleContent>
      )}
    </Collapsible>
  )
}

export default function MessagesTab() {
  const [channelFilter, setChannelFilter] = useState<ChannelType | 'all'>('all')
  const [directionFilter, setDirectionFilter] = useState<'all' | 'incoming' | 'outgoing'>('all')
  const [searchQuery, setSearchQuery] = useState('')

  const { data: counts, isLoading: countsLoading } = useChannelMessageCounts()
  const { data: messagesData, isLoading: messagesLoading, error: messagesError } = useChannelMessages({
    channel: channelFilter,
    direction: directionFilter === 'all' ? undefined : directionFilter,
    search: searchQuery || undefined,
    limit: 50,
  })

  const isLoading = countsLoading || messagesLoading
  const totalCount = counts ? Object.values(counts).reduce((a, b) => a + b, 0) : 0

  return (
    <div className="space-y-6">
      {/* Stats Summary */}
      {counts && (
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
          <StatCard label="Total" value={totalCount} icon={MessageMultiple01Icon} />
          <StatCard label="Email" value={counts.email || 0} icon={Mail01Icon} />
          <StatCard label="WhatsApp" value={counts.whatsapp || 0} icon={WhatsappIcon} />
          <StatCard label="Discord" value={counts.discord || 0} icon={DiscordIcon} />
          <StatCard label="Telegram" value={counts.telegram || 0} icon={TelegramIcon} />
          <StatCard label="Slack" value={counts.slack || 0} icon={SlackIcon} />
        </div>
      )}

      {/* Messages List */}
      <Card>
        <CardHeader className="pb-2">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <CardTitle className="text-base font-medium flex items-center gap-2">
              <HugeiconsIcon icon={SentIcon} size={16} strokeWidth={2} />
              Channel Messages
            </CardTitle>
            <div className="flex flex-wrap items-center gap-2">
              {/* Search */}
              <div className="relative">
                <HugeiconsIcon
                  icon={Search01Icon}
                  size={14}
                  strokeWidth={2}
                  className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground"
                />
                <Input
                  type="text"
                  placeholder="Search..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-8 h-8 w-[140px] sm:w-[180px]"
                />
              </div>

              {/* Channel Filter */}
              <Select value={channelFilter} onValueChange={(v) => v && setChannelFilter(v as ChannelType | 'all')}>
                <SelectTrigger size="sm" className="w-[110px] shrink-0 gap-1.5">
                  <HugeiconsIcon icon={FilterIcon} size={12} strokeWidth={2} className="text-muted-foreground" />
                  <SelectValue>
                    {channelFilter === 'all' ? 'All' : channelFilter}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Channels</SelectItem>
                  <SelectItem value="email">Email</SelectItem>
                  <SelectItem value="whatsapp">WhatsApp</SelectItem>
                  <SelectItem value="discord">Discord</SelectItem>
                  <SelectItem value="telegram">Telegram</SelectItem>
                  <SelectItem value="slack">Slack</SelectItem>
                </SelectContent>
              </Select>

              {/* Direction Filter */}
              <Select value={directionFilter} onValueChange={(v) => v && setDirectionFilter(v as 'all' | 'incoming' | 'outgoing')}>
                <SelectTrigger size="sm" className="w-[110px] shrink-0 gap-1.5">
                  <SelectValue>
                    {directionFilter === 'all' ? 'All' : directionFilter}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All</SelectItem>
                  <SelectItem value="incoming">Incoming</SelectItem>
                  <SelectItem value="outgoing">Outgoing</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {/* Loading State */}
          {isLoading && !messagesData && (
            <div className="flex items-center justify-center py-12">
              <HugeiconsIcon icon={Loading03Icon} size={24} strokeWidth={2} className="animate-spin text-muted-foreground" />
            </div>
          )}

          {/* Error State */}
          {messagesError && (
            <div className="flex items-center gap-3 py-6 px-4 text-destructive">
              <HugeiconsIcon icon={Alert02Icon} size={20} strokeWidth={2} />
              <span className="text-sm">{messagesError.message}</span>
            </div>
          )}

          {/* Messages List */}
          {messagesData?.messages && messagesData.messages.length > 0 ? (
            <div className="divide-y">
              {messagesData.messages.map((message) => (
                <MessageRow key={message.id} message={message} />
              ))}
            </div>
          ) : !isLoading && (
            <div className="py-8 text-center text-sm text-muted-foreground">
              No messages found
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
