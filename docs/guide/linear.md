# Linear Integration

Vibora can sync task status with Linear tickets, keeping your project management in sync with your AI coding workflow.

## Setup

### Get a Linear API Key

1. Go to Linear **Settings → API**
2. Create a new personal API key
3. Copy the key

### Configure Vibora

Set the API key in Vibora:

```bash
vibora config set integrations.linearApiKey YOUR_API_KEY
```

Or use an environment variable:

```bash
export LINEAR_API_KEY=YOUR_API_KEY
```

## Linking Tasks

Link a Vibora task to a Linear ticket:

```bash
vibora current-task linear https://linear.app/team/issue/TEAM-123
```

From within a task worktree, this links the current task to the specified Linear ticket.

## Automatic Status Sync

When a task status changes in Vibora, the linked Linear ticket updates automatically:

| Vibora Status | Linear Status |
|---------------|---------------|
| In Progress | In Progress |
| In Review | In Review |
| Done | Done |
| Canceled | Canceled |

::: tip
The exact Linear status names may vary depending on your team's workflow configuration. Vibora maps to the closest matching status.
:::

## Creating Tasks from Linear

You can create a Vibora task and immediately link it to a Linear ticket:

1. Copy the Linear ticket URL
2. Create a new task in Vibora
3. Run `vibora current-task linear <url>` in the task terminal

## Unlinking Tasks

To remove the Linear link:

```bash
vibora current-task linear --unlink
```

## Troubleshooting

### Status Not Syncing

Check that:
1. The API key is configured correctly
2. You have permission to update the ticket
3. The Linear URL is valid

View API errors in the logs:

```bash
grep '"src":"Linear"' ~/.vibora/vibora.log | tail -20
```

### Rate Limiting

Linear has API rate limits. If you're making many rapid status changes, some may be delayed or fail. Vibora handles this gracefully and will retry.
