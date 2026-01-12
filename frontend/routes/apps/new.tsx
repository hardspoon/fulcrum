import { createFileRoute, redirect } from '@tanstack/react-router'

/**
 * Legacy route: /apps/new
 * Redirects to /projects
 */
export const Route = createFileRoute('/apps/new')({
  beforeLoad: () => {
    throw redirect({ to: '/projects' })
  },
})
