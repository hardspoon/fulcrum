# MCP Tools

The Vibora plugin includes an MCP server that exposes task management and remote execution tools to Claude.

## Setup

### Claude Code

The MCP server is automatically available when using the Vibora plugin with Claude Code.

### Claude Desktop

Add to your `claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "vibora": {
      "command": "vibora",
      "args": ["mcp"]
    }
  }
}
```

## Task Management Tools

### `list_tasks`

List all tasks with optional filtering.

**Parameters:**
| Name | Type | Description |
|------|------|-------------|
| `status` | string | Filter by status (IN_PROGRESS, IN_REVIEW, DONE, CANCELED) |
| `repository` | string | Filter by repository name |

**Example:**
```json
{
  "status": "IN_PROGRESS"
}
```

### `get_task`

Get details about a specific task.

**Parameters:**
| Name | Type | Description |
|------|------|-------------|
| `id` | string | Task ID (required) |

### `create_task`

Create a new task with git worktree.

**Parameters:**
| Name | Type | Description |
|------|------|-------------|
| `title` | string | Task title (required) |
| `description` | string | Task description |
| `repositoryId` | string | Repository ID (required) |
| `baseBranch` | string | Branch to create worktree from |

### `update_task`

Update a task's title or description.

**Parameters:**
| Name | Type | Description |
|------|------|-------------|
| `id` | string | Task ID (required) |
| `title` | string | New title |
| `description` | string | New description |

### `delete_task`

Delete a task and its worktree.

**Parameters:**
| Name | Type | Description |
|------|------|-------------|
| `id` | string | Task ID (required) |

### `move_task`

Change a task's status.

**Parameters:**
| Name | Type | Description |
|------|------|-------------|
| `id` | string | Task ID (required) |
| `status` | string | New status (IN_PROGRESS, IN_REVIEW, DONE, CANCELED) |

### `list_repositories`

List all configured repositories.

**Parameters:** None

### `send_notification`

Send a notification to enabled channels.

**Parameters:**
| Name | Type | Description |
|------|------|-------------|
| `title` | string | Notification title (required) |
| `message` | string | Notification message |

## Remote Execution Tools

### `execute_command`

Execute a shell command on the Vibora server.

**Parameters:**
| Name | Type | Description |
|------|------|-------------|
| `command` | string | Command to execute (required) |
| `sessionId` | string | Session ID for persistent environment |
| `sessionName` | string | Human-readable session name |
| `cwd` | string | Working directory |

**Features:**
- Persistent sessions with preserved environment
- Working directory persists between commands
- Shell state (aliases, functions) preserved

**Example:**
```json
{
  "command": "cd /project && npm install",
  "sessionId": "my-session",
  "sessionName": "Project Setup"
}
```

### `list_exec_sessions`

List active command execution sessions.

**Parameters:** None

**Returns:**
- Session IDs
- Session names
- Working directories
- Creation timestamps

### `update_exec_session`

Rename a session.

**Parameters:**
| Name | Type | Description |
|------|------|-------------|
| `sessionId` | string | Session ID (required) |
| `sessionName` | string | New name (required) |

### `destroy_exec_session`

Clean up a session.

**Parameters:**
| Name | Type | Description |
|------|------|-------------|
| `sessionId` | string | Session ID (required) |

## Example Usage

Claude can use these tools to manage tasks autonomously:

```
I'll create a new task for implementing the authentication feature.

[Uses create_task with title "Add user authentication" and repositoryId "abc123"]

Task created. Let me check the current status of all tasks.

[Uses list_tasks with status "IN_PROGRESS"]

I see there are 3 tasks in progress. I'll update the description of the auth task.

[Uses update_task with id and new description]
```

## Error Handling

All tools return errors in a consistent format:

```json
{
  "error": "Task not found",
  "code": "NOT_FOUND"
}
```

Common error codes:
- `NOT_FOUND` — Resource doesn't exist
- `INVALID_INPUT` — Invalid parameters
- `PERMISSION_DENIED` — Operation not allowed
- `SERVER_ERROR` — Internal error
