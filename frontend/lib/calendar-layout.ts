export interface TimedItem {
  id: string
  startMinutes: number
  endMinutes: number
}

export interface LayoutPosition {
  id: string
  top: number
  height: number
  left: number
  width: number
}

const MIN_HEIGHT = 20

/**
 * Compute side-by-side layout positions for overlapping timed events.
 *
 * Algorithm:
 * 1. Sort by start time, then longest duration first
 * 2. Sweep-line to find clusters of overlapping events
 * 3. Greedy column assignment within each cluster
 * 4. Position: left = col/maxCols, width = 1/maxCols
 */
export function layoutEvents(
  items: TimedItem[],
  hourHeight: number,
): LayoutPosition[] {
  if (items.length === 0) return []

  const sorted = [...items].sort((a, b) => {
    if (a.startMinutes !== b.startMinutes) return a.startMinutes - b.startMinutes
    // Longer events first (so they get earlier columns)
    return (b.endMinutes - b.startMinutes) - (a.endMinutes - a.startMinutes)
  })

  // Find clusters (connected groups of overlapping events)
  const clusters: TimedItem[][] = []
  let cluster: TimedItem[] = []
  let clusterEnd = -1

  for (const item of sorted) {
    if (cluster.length === 0 || item.startMinutes < clusterEnd) {
      cluster.push(item)
      clusterEnd = Math.max(clusterEnd, item.endMinutes)
    } else {
      clusters.push(cluster)
      cluster = [item]
      clusterEnd = item.endMinutes
    }
  }
  if (cluster.length > 0) clusters.push(cluster)

  const results: LayoutPosition[] = []

  for (const group of clusters) {
    // Assign columns within each cluster
    const columns: TimedItem[][] = []

    for (const item of group) {
      let placed = false
      for (const col of columns) {
        if (col[col.length - 1].endMinutes <= item.startMinutes) {
          col.push(item)
          placed = true
          break
        }
      }
      if (!placed) {
        columns.push([item])
      }
    }

    const maxCols = columns.length

    for (let colIndex = 0; colIndex < columns.length; colIndex++) {
      for (const item of columns[colIndex]) {
        const pixelsPerMinute = hourHeight / 60
        const top = item.startMinutes * pixelsPerMinute
        const rawHeight = (item.endMinutes - item.startMinutes) * pixelsPerMinute
        const height = Math.max(rawHeight, MIN_HEIGHT)

        results.push({
          id: item.id,
          top,
          height,
          left: colIndex / maxCols,
          width: 1 / maxCols,
        })
      }
    }
  }

  return results
}

/**
 * Parse an ISO datetime string into minutes since midnight.
 * Returns null if the string has no time component.
 */
export function parseTimeToMinutes(dt: string | null): number | null {
  if (!dt || !dt.includes('T')) return null
  const timePart = dt.split('T')[1]
  const [hours, minutes] = timePart.split(':').map(Number)
  return hours * 60 + minutes
}
