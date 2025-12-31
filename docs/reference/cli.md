# CLI Commands

The Vibora CLI lets you manage the server and interact with tasks from the command line.

## Server Management

### `vibora up`

Start the Vibora server.

```bash
vibora up                  # Start server daemon
vibora up -y               # Start with auto-install (no prompts)
```

### `vibora down`

Stop the server.

```bash
vibora down
```

### `vibora status`

Check if the server is running.

```bash
vibora status
```

### `vibora doctor`

Check all dependencies and their versions.

```bash
vibora doctor
```

### `vibora health`

Check server health.

```bash
vibora health
```

### `vibora mcp`

Start the MCP server (stdio mode for Claude Desktop).

```bash
vibora mcp
```

## Current Task Commands

These commands operate on the task detected from your current working directory.

### `vibora current-task`

Get info about the current task.

```bash
vibora current-task              # Show task info
vibora current-task in-progress  # Mark as IN_PROGRESS
vibora current-task review       # Mark as IN_REVIEW
vibora current-task done         # Mark as DONE
vibora current-task cancel       # Mark as CANCELED
```

### `vibora current-task pr`

Associate a pull request with the current task.

```bash
vibora current-task pr <url>     # Link a PR
vibora current-task pr --unlink  # Remove PR link
```

### `vibora current-task linear`

Link to a Linear ticket.

```bash
vibora current-task linear <url>     # Link to Linear
vibora current-task linear --unlink  # Remove link
```

## Task Management

### `vibora tasks list`

List all tasks.

```bash
vibora tasks list
vibora tasks list --status IN_PROGRESS
vibora tasks list --repo my-repo
```

### `vibora tasks get`

Get a task by ID.

```bash
vibora tasks get <id>
```

### `vibora tasks create`

Create a new task.

```bash
vibora tasks create
```

### `vibora tasks update`

Update a task.

```bash
vibora tasks update <id>
```

### `vibora tasks move`

Move a task to a different status.

```bash
vibora tasks move <id>
```

### `vibora tasks delete`

Delete a task.

```bash
vibora tasks delete <id>
```

## Git Operations

### `vibora git status`

Show git status for the current worktree.

```bash
vibora git status
```

### `vibora git diff`

Show git diff for the current worktree.

```bash
vibora git diff
```

### `vibora git branches`

List branches in a repository.

```bash
vibora git branches
```

## Worktrees

### `vibora worktrees list`

List all worktrees.

```bash
vibora worktrees list
```

### `vibora worktrees delete`

Delete a worktree.

```bash
vibora worktrees delete
```

## Configuration

### `vibora config get`

Get a configuration value.

```bash
vibora config get <key>
vibora config get server.port
```

### `vibora config set`

Set a configuration value.

```bash
vibora config set <key> <value>
vibora config set server.port 8080
```

## Notifications

### `vibora notifications`

Show notification settings.

```bash
vibora notifications
```

### `vibora notifications enable`

Enable notifications.

```bash
vibora notifications enable
```

### `vibora notifications disable`

Disable notifications.

```bash
vibora notifications disable
```

### `vibora notifications test`

Test a notification channel.

```bash
vibora notifications test <channel>
```

### `vibora notify`

Send a notification.

```bash
vibora notify <title> [message]
```

## Global Options

These options work with any command:

| Option | Description |
|--------|-------------|
| `--port=<port>` | Server port (default: 7777) |
| `--url=<url>` | Override full server URL |
| `--pretty` | Pretty-print JSON output |
| `--json` | Force JSON output |
