import { useState, useRef, useCallback, useEffect, forwardRef, useImperativeHandle } from 'react'
import { useTranslation } from 'react-i18next'
import { Send, Loader2, Paperclip, X, Square, FileText } from 'lucide-react'
import { cn } from '@/lib/utils'

export interface FileAttachment {
  id: string
  file: File
  dataUrl: string // data URL for images/binary files, text content for text files
  mediaType: string
  filename: string
  type: 'image' | 'document' | 'text'
}

/** @deprecated Use FileAttachment instead */
export type ImageAttachment = FileAttachment

interface ChatInputProps {
  onSend: (message: string, attachments?: FileAttachment[]) => void
  isLoading?: boolean
  placeholder?: string
  onCancel?: () => void
}

export interface ChatInputHandle {
  focus: () => void
}

const MAX_FILE_SIZE = 10 * 1024 * 1024 // 10MB

function classifyFile(file: File): FileAttachment['type'] {
  if (file.type.startsWith('image/')) return 'image'
  if (file.type === 'application/pdf') return 'document'
  return 'text'
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

export const ChatInput = forwardRef<ChatInputHandle, ChatInputProps>(function ChatInput(
  { onSend, isLoading, placeholder, onCancel },
  ref
) {
  const { t } = useTranslation('assistant')
  const finalPlaceholder = placeholder ?? t('input.placeholder')
  const [value, setValue] = useState('')
  const [attachments, setAttachments] = useState<FileAttachment[]>([])
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Expose focus method to parent
  useImperativeHandle(ref, () => ({
    focus: () => {
      textareaRef.current?.focus()
    },
  }))

  // Handle file selection
  const handleFiles = useCallback(async (files: FileList | null) => {
    if (!files) return

    const newAttachments: FileAttachment[] = []

    for (const file of Array.from(files)) {
      // Validate file size
      if (file.size > MAX_FILE_SIZE) {
        continue
      }

      const fileType = classifyFile(file)

      let dataUrl: string
      if (fileType === 'text') {
        // Read text files as text
        dataUrl = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader()
          reader.onload = () => resolve(reader.result as string)
          reader.onerror = reject
          reader.readAsText(file)
        })
      } else {
        // Read images and PDFs as data URL
        dataUrl = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader()
          reader.onload = () => resolve(reader.result as string)
          reader.onerror = reject
          reader.readAsDataURL(file)
        })
      }

      newAttachments.push({
        id: crypto.randomUUID(),
        file,
        dataUrl,
        mediaType: file.type || 'application/octet-stream',
        filename: file.name,
        type: fileType,
      })
    }

    if (newAttachments.length > 0) {
      setAttachments((prev) => [...prev, ...newAttachments])
    }
  }, [])

  // Handle paste event
  const handlePaste = useCallback(
    async (e: React.ClipboardEvent) => {
      const items = e.clipboardData?.items
      if (!items) return

      const pastedFiles: File[] = []

      for (const item of Array.from(items)) {
        if (item.kind === 'file') {
          const file = item.getAsFile()
          if (file) {
            pastedFiles.push(file)
          }
        }
      }

      if (pastedFiles.length > 0) {
        e.preventDefault()
        const fileList = new DataTransfer()
        pastedFiles.forEach((f) => fileList.items.add(f))
        await handleFiles(fileList.files)
      }
    },
    [handleFiles]
  )

  // Remove an attachment
  const removeAttachment = useCallback((id: string) => {
    setAttachments((prev) => prev.filter((a) => a.id !== id))
  }, [])

  // Auto-resize textarea
  const adjustHeight = useCallback(() => {
    const textarea = textareaRef.current
    if (textarea) {
      textarea.style.height = 'auto'
      textarea.style.height = `${Math.min(textarea.scrollHeight, 150)}px`
    }
  }, [])

  useEffect(() => {
    adjustHeight()
  }, [value, adjustHeight])

  const handleSubmit = useCallback(() => {
    const trimmed = value.trim()
    const hasContent = trimmed || attachments.length > 0
    if (hasContent && !isLoading) {
      onSend(trimmed, attachments.length > 0 ? attachments : undefined)
      setValue('')
      setAttachments([])
      // Reset height
      if (textareaRef.current) {
        textareaRef.current.style.height = 'auto'
      }
    }
  }, [value, attachments, isLoading, onSend])

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault()
        handleSubmit()
      }
    },
    [handleSubmit]
  )

  const hasContent = value.trim() || attachments.length > 0

  return (
    <div className="relative">
      {/* Attachment Previews */}
      {attachments.length > 0 && (
        <div className="px-4 pt-4 flex flex-wrap gap-2">
          {attachments.map((attachment) => (
            <div key={attachment.id} className="relative group">
              {attachment.type === 'image' ? (
                <img
                  src={attachment.dataUrl}
                  alt={attachment.filename}
                  className="h-16 w-16 object-cover rounded-lg border border-border"
                />
              ) : (
                <div className="h-16 px-3 flex items-center gap-2 rounded-lg border border-border bg-muted/50 max-w-[200px]">
                  <FileText className="w-5 h-5 shrink-0 text-muted-foreground" />
                  <div className="min-w-0">
                    <p className="text-xs font-medium truncate">{attachment.filename}</p>
                    <p className="text-[10px] text-muted-foreground">{formatFileSize(attachment.file.size)}</p>
                  </div>
                </div>
              )}
              <button
                onClick={() => removeAttachment(attachment.id)}
                className="absolute -top-1.5 -right-1.5 p-0.5 rounded-full bg-destructive text-destructive-foreground opacity-0 group-hover:opacity-100 transition-opacity"
              >
                <X className="w-3 h-3" />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Textarea */}
      <div className="relative overflow-hidden">
        <textarea
          ref={textareaRef}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={handleKeyDown}
          onPaste={handlePaste}
          rows={3}
          disabled={isLoading}
          className="w-full px-6 py-4 bg-transparent border-none outline-none resize-none text-base font-sans font-normal leading-relaxed min-h-[100px] disabled:opacity-50 text-foreground placeholder-muted-foreground caret-current"
          placeholder={finalPlaceholder}
          style={{ scrollbarWidth: 'none' }}
        />
      </div>

      {/* Hidden file input */}
      <input
        ref={fileInputRef}
        type="file"
        multiple
        className="hidden"
        onChange={(e) => handleFiles(e.target.files)}
      />

      {/* Controls Section */}
      <div className="px-4 pb-4">
        <div className="flex items-center justify-between">
          {/* Attach Button */}
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={isLoading}
            className={cn(
              'p-2 rounded-lg transition-colors',
              'text-muted-foreground hover:text-foreground hover:bg-muted/50',
              'disabled:opacity-50 disabled:cursor-not-allowed'
            )}
            title="Attach file"
          >
            <Paperclip className="w-5 h-5" />
          </button>

          {/* Send/Stop Button */}
          {isLoading && onCancel ? (
            <button
              onClick={onCancel}
              className="group relative p-3 border-none rounded-lg cursor-pointer transition-all duration-300 shadow-lg hover:scale-105 hover:shadow-xl active:scale-95 transform bg-accent text-accent-foreground hover:bg-accent/90"
              style={{
                boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 0 0 0 color-mix(in oklch, var(--accent) 30%, transparent)',
              }}
              title="Stop generating"
            >
              <Square className="w-5 h-5 fill-current" />

              {/* Animated background glow */}
              <div className="absolute inset-0 rounded-lg opacity-0 group-hover:opacity-50 transition-opacity duration-300 blur-lg transform scale-110 bg-accent" />

              {/* Ripple effect on click */}
              <div className="absolute inset-0 rounded-lg overflow-hidden">
                <div className="absolute inset-0 bg-white/20 transform scale-0 group-active:scale-100 transition-transform duration-200 rounded-lg" />
              </div>
            </button>
          ) : (
            <button
              onClick={handleSubmit}
              disabled={!hasContent || isLoading}
              className="group relative p-3 border-none rounded-lg cursor-pointer transition-all duration-300 shadow-lg hover:scale-105 hover:shadow-xl active:scale-95 transform disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100 disabled:hover:shadow-lg bg-accent text-accent-foreground hover:bg-accent/90"
              style={{
                boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 0 0 0 color-mix(in oklch, var(--accent) 30%, transparent)',
              }}
            >
              {isLoading ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : (
                <Send className="w-5 h-5 transition-all duration-300 group-hover:-translate-y-0.5 group-hover:translate-x-0.5 group-hover:rotate-12" />
              )}

              {/* Animated background glow */}
              <div className="absolute inset-0 rounded-lg opacity-0 group-hover:opacity-50 transition-opacity duration-300 blur-lg transform scale-110 bg-accent" />

              {/* Ripple effect on click */}
              <div className="absolute inset-0 rounded-lg overflow-hidden">
                <div className="absolute inset-0 bg-white/20 transform scale-0 group-active:scale-100 transition-transform duration-200 rounded-lg" />
              </div>
            </button>
          )}
        </div>
      </div>
    </div>
  )
})
