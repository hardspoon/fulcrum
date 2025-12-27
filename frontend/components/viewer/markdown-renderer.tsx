import { useMemo } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { ScrollArea } from '@/components/ui/scroll-area'

interface MarkdownRendererProps {
  content: string
  worktreePath: string
  filePath: string
}

/**
 * Resolve a relative image path to an absolute path based on the markdown file location
 */
function resolveImagePath(src: string, filePath: string): string {
  // Already absolute or external URL
  if (src.startsWith('/') || src.startsWith('http://') || src.startsWith('https://') || src.startsWith('data:')) {
    return src
  }

  // Get the directory of the markdown file
  const fileDir = filePath.includes('/') ? filePath.substring(0, filePath.lastIndexOf('/')) : ''

  // Resolve relative path
  const parts = fileDir ? fileDir.split('/') : []
  const srcParts = src.split('/')

  for (const part of srcParts) {
    if (part === '..') {
      parts.pop()
    } else if (part !== '.') {
      parts.push(part)
    }
  }

  return parts.join('/')
}

export function MarkdownRenderer({ content, worktreePath, filePath }: MarkdownRendererProps) {
  // Memoize the image component to avoid recreating on every render
  const components = useMemo(
    () => ({
      // Custom image handling to resolve relative paths
      img: ({ src, alt, ...props }: React.ImgHTMLAttributes<HTMLImageElement>) => {
        if (!src) return null

        let imageSrc = src

        // Transform relative paths to use the image API endpoint
        if (!src.startsWith('http://') && !src.startsWith('https://') && !src.startsWith('data:')) {
          const resolvedPath = resolveImagePath(src, filePath)
          const params = new URLSearchParams({
            path: resolvedPath,
            root: worktreePath,
          })
          imageSrc = `/api/fs/image?${params}`
        }

        return (
          <img
            src={imageSrc}
            alt={alt || ''}
            className="max-w-full"
            loading="lazy"
            {...props}
          />
        )
      },
      // Custom link handling to open in new tab
      a: ({ href, children, ...props }: React.AnchorHTMLAttributes<HTMLAnchorElement>) => (
        <a
          href={href}
          target="_blank"
          rel="noopener noreferrer"
          {...props}
        >
          {children}
        </a>
      ),
      // Custom code block styling
      pre: ({ children, ...props }: React.HTMLAttributes<HTMLPreElement>) => (
        <pre className="overflow-x-auto" {...props}>
          {children}
        </pre>
      ),
      // Custom table styling for better dark mode
      table: ({ children, ...props }: React.TableHTMLAttributes<HTMLTableElement>) => (
        <div className="overflow-x-auto">
          <table className="border-collapse border border-border" {...props}>
            {children}
          </table>
        </div>
      ),
      th: ({ children, ...props }: React.ThHTMLAttributes<HTMLTableHeaderCellElement>) => (
        <th className="border border-border bg-muted px-3 py-2 text-left" {...props}>
          {children}
        </th>
      ),
      td: ({ children, ...props }: React.TdHTMLAttributes<HTMLTableDataCellElement>) => (
        <td className="border border-border px-3 py-2" {...props}>
          {children}
        </td>
      ),
    }),
    [worktreePath, filePath]
  )

  return (
    <ScrollArea className="h-full">
      <div className="p-4 max-w-none prose prose-sm dark:prose-invert prose-headings:font-semibold prose-headings:text-foreground prose-p:text-foreground prose-strong:text-foreground prose-a:text-primary prose-code:text-foreground prose-code:bg-muted prose-code:px-1 prose-code:py-0.5 prose-code:rounded prose-code:before:content-none prose-code:after:content-none prose-pre:bg-muted prose-pre:border prose-pre:border-border prose-blockquote:border-l-primary prose-blockquote:text-muted-foreground prose-li:text-foreground prose-th:text-foreground prose-td:text-foreground prose-img:rounded prose-img:border prose-img:border-border">
        <ReactMarkdown remarkPlugins={[remarkGfm]} components={components}>
          {content}
        </ReactMarkdown>
      </div>
    </ScrollArea>
  )
}
