import { createFileRoute, redirect } from '@tanstack/react-router'

// Redirect /review to /monitoring?tab=review
export const Route = createFileRoute('/review/')({
  beforeLoad: () => {
    throw redirect({ to: '/monitoring', search: { tab: 'review' } })
  },
  component: () => null,
})
