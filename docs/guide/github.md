# GitHub Integration

Vibora integrates with GitHub for PR monitoring and repository management.

## Setup

### Personal Access Token (Optional)

For private repositories or higher rate limits, configure a GitHub PAT:

```bash
vibora config set integrations.githubPat YOUR_PAT
```

Or use an environment variable:

```bash
export GITHUB_PAT=YOUR_PAT
```

The PAT needs `repo` scope for private repositories.

## PR Monitoring

The **PR Review** view shows pull requests across all your repositories.

### Features

- **Filter by status** — Open, closed, merged
- **Filter by repository** — Focus on specific projects
- **Filter by author** — See your PRs or team members'
- **Quick actions** — Open in browser, copy URL

### Linking PRs to Tasks

Associate a PR with your current task:

```bash
vibora current-task pr https://github.com/org/repo/pull/123
```

The PR appears on the task card and in the Kanban view.

## Repository Management

The **Repositories** view shows all configured repositories.

### Adding a Repository

1. Navigate to **Repositories**
2. Click **Add Repository**
3. Enter the repository path (local filesystem path)

### Repository Settings

Each repository can have:

- **Startup Script** — Commands to run when creating new tasks
- **Copy Files** — Patterns for files to copy to new worktrees

### Quick Actions

- **New Task** — Create a task in this repository
- **Open Terminal** — Open a terminal in the repository root
- **Open in Editor** — Launch your editor

## Checking PR Status

From the CLI:

```bash
vibora current-task          # Shows linked PR info
```

## Rate Limits

GitHub has API rate limits:

- **Unauthenticated** — 60 requests/hour
- **Authenticated** — 5,000 requests/hour

Configure a PAT to avoid rate limiting with many repositories.
