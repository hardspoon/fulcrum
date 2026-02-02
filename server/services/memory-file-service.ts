/**
 * Memory File Service - Read/write the master MEMORY.md file
 *
 * The memory file is a single structured markdown document for persistent knowledge.
 * Its content is injected into every system prompt.
 */
import { readFileSync, writeFileSync, existsSync } from 'node:fs'
import { join } from 'node:path'
import { getFulcrumDir } from '../lib/settings/paths'

const MEMORY_FILENAME = 'MEMORY.md'

/** Get the full path to the memory file */
export function getMemoryFilePath(): string {
  return join(getFulcrumDir(), MEMORY_FILENAME)
}

/** Read the memory file content. Returns empty string if file doesn't exist. */
export function readMemoryFile(): string {
  const filePath = getMemoryFilePath()
  if (!existsSync(filePath)) return ''
  return readFileSync(filePath, 'utf-8')
}

/** Write the entire memory file. */
export function writeMemoryFile(content: string): void {
  const filePath = getMemoryFilePath()
  writeFileSync(filePath, content, 'utf-8')
}

/**
 * Update a specific section of the memory file by heading.
 * Finds the heading, replaces content up to the next same-or-higher-level heading.
 * If heading not found, appends a new section at the end.
 * Skips headings inside fenced code blocks.
 */
export function updateMemoryFileSection(heading: string, content: string): void {
  const current = readMemoryFile()

  // Determine the heading level from the input (e.g., "## Preferences" → level 2)
  const headingMatch = heading.match(/^(#{1,6})\s+/)
  const headingLevel = headingMatch ? headingMatch[1].length : 2
  const normalizedHeading = heading.trim()

  // If file is empty, just write the new section
  if (!current.trim()) {
    writeMemoryFile(`${normalizedHeading}\n\n${content}\n`)
    return
  }

  const lines = current.split('\n')
  let sectionStart = -1
  let sectionEnd = -1
  let inCodeBlock = false

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]

    // Track fenced code blocks
    if (line.trimStart().startsWith('```')) {
      inCodeBlock = !inCodeBlock
      continue
    }
    if (inCodeBlock) continue

    // Check for heading match
    if (line.trim() === normalizedHeading) {
      sectionStart = i
      // Find the end of this section (next same-or-higher-level heading)
      for (let j = i + 1; j < lines.length; j++) {
        const nextLine = lines[j]

        if (nextLine.trimStart().startsWith('```')) {
          inCodeBlock = !inCodeBlock
          continue
        }
        if (inCodeBlock) continue

        const nextHeadingMatch = nextLine.match(/^(#{1,6})\s+/)
        if (nextHeadingMatch && nextHeadingMatch[1].length <= headingLevel) {
          sectionEnd = j
          break
        }
      }
      if (sectionEnd === -1) sectionEnd = lines.length
      break
    }
  }

  if (sectionStart !== -1) {
    // Replace existing section
    const before = lines.slice(0, sectionStart)
    const after = lines.slice(sectionEnd)
    const newSection = [`${normalizedHeading}`, '', content]
    const result = [...before, ...newSection, '', ...after].join('\n')
    // Clean up excessive blank lines
    writeMemoryFile(result.replace(/\n{3,}/g, '\n\n').trimEnd() + '\n')
  } else {
    // Append new section at the end
    const separator = current.endsWith('\n') ? '\n' : '\n\n'
    writeMemoryFile(`${current}${separator}${normalizedHeading}\n\n${content}\n`)
  }
}
