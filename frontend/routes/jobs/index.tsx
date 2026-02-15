import { useState } from 'react'
import { createFileRoute } from '@tanstack/react-router'
import { JobsTab } from '@/components/monitoring/tabs'
import { useJobsAvailable } from '@/hooks/use-jobs'

type JobScope = 'all' | 'user' | 'system'

export const Route = createFileRoute('/jobs/')({
  component: JobsPage,
  validateSearch: (search: Record<string, unknown>): { scope?: JobScope } => ({
    scope: ['all', 'user', 'system'].includes(search.scope as string) ? (search.scope as JobScope) : undefined,
  }),
})

function JobsPage() {
  const { scope: urlScope } = Route.useSearch()
  const navigate = Route.useNavigate()
  const { data: jobsAvailable, isLoading } = useJobsAvailable()
  const [scopeFilter, setScopeFilter] = useState<JobScope>(urlScope || 'user')

  const handleScopeChange = (scope: JobScope) => {
    setScopeFilter(scope)
    navigate({
      search: (prev) => ({ ...prev, scope: scope === 'user' ? undefined : scope }),
      replace: true,
    })
  }

  if (isLoading) return null

  if (!jobsAvailable?.available) {
    return (
      <div className="flex h-full items-center justify-center p-8">
        <p className="text-sm text-muted-foreground">Jobs are not available on this platform.</p>
      </div>
    )
  }

  return (
    <div className="flex h-full flex-col overflow-auto p-4">
      <JobsTab scopeFilter={scopeFilter} onScopeChange={handleScopeChange} />
    </div>
  )
}
