# GitHub Integration

Vibora integrates with GitHub for PR monitoring and repository management.

## Setup

### Personal Access Token (Optional)

For private repositories or higher rate limits, configure a GitHub PAT.

**From the CLI:**

```bash
vibora config set integrations.githubPat YOUR_PAT
```

**From the UI:**

Go to **Settings > Integrations** and enter your PAT in the GitHub section.

The PAT needs `repo` scope for private repositories.

## PR Monitoring

The **PR Review** view shows pull requests across all your repositories.

### Features

- **Filter by status** — Open, closed, merged
- **Filter by repository** — Focus on specific projects
- **Filter by author** — See your PRs or team members'
- **Quick actions** — Open in browser, copy URL

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
