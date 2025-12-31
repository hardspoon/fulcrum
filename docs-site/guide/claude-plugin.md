# Claude Code Plugin

The Vibora plugin for Claude Code enables deep integration between your AI coding sessions and task management.

## Installation

```bash
claude plugin marketplace add knowsuchagency/vibora
claude plugin install vibora@vibora --scope user
```

The plugin is also automatically installed when using the desktop app.

## Features

### Automatic Status Sync

When working in a task worktree:

- **Claude stops and waits for input** → Task moves to "In Review"
- **You respond to Claude** → Task moves to "In Progress"

This happens automatically—no manual status updates needed.

### Slash Commands

The plugin provides several slash commands:

| Command | Description |
|---------|-------------|
| `/review` | Mark current task as In Review |
| `/pr` | Associate a PR with current task |
| `/notify` | Send a notification |
| `/linear` | Link to a Linear ticket |
| `/task-info` | Show current task details |

### Session Continuity

Claude sessions are tied to task IDs. When you return to a task, Claude has context from previous sessions.

### Vibora Skill

The plugin includes a skill that provides Claude with CLI documentation for task management. Claude can use this to understand how to interact with Vibora.

## MCP Server

The plugin includes an MCP server that exposes task management and remote execution tools directly to Claude.

### Task Management Tools

| Tool | Description |
|------|-------------|
| `list_tasks` | List all tasks with optional status/repo filter |
| `get_task` | Get task details by ID |
| `create_task` | Create a new task with git worktree |
| `update_task` | Update task title/description |
| `delete_task` | Delete a task |
| `move_task` | Change task status |
| `list_repositories` | List configured repositories |
| `send_notification` | Send notification to enabled channels |

### Remote Command Execution

| Tool | Description |
|------|-------------|
| `execute_command` | Execute shell commands on the Vibora server |
| `list_exec_sessions` | List active command execution sessions |
| `update_exec_session` | Rename a session |
| `destroy_exec_session` | Clean up a session |

The `execute_command` tool supports persistent sessions where environment variables, working directory, and shell state are preserved between commands.

### Using with Claude Desktop

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

## How It Works

The plugin detects when you're in a task worktree by checking the current directory against known worktree paths. It then:

1. **Identifies the current task** from the worktree path
2. **Registers hooks** for session events (stop, resume)
3. **Updates task status** via the Vibora API
4. **Exposes MCP tools** for Claude to use

## Manual Plugin Development

The plugin source is in `plugins/vibora/` in the Vibora repository. Key files:

```
plugins/vibora/
├── .claude-plugin/
│   └── plugin.json      # Plugin manifest
├── skills/
│   └── vibora.md        # CLI documentation skill
└── hooks/
    └── *.sh             # Event hooks
```
