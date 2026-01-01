# Terminal Management

Vibora provides two types of terminal organization: task terminals and persistent terminal tabs.

## Task Terminals

Every task has a terminal that runs in its isolated git worktree. These terminals are where you run Claude Code and do your work.

### Task Terminals View

The **Task Terminals** view shows all terminals across every task in a parallel grid. This is Vibora's killer feature for orchestrating multiple Claude Code sessions.

From this view you can:
- See all active Claude sessions at once
- Click into any terminal to interact
- Monitor progress across multiple agents
- Quickly identify which tasks need attention

## Persistent Terminal Tabs

For work that doesn't fit into task worktrees, use persistent terminal tabs.

### Creating Tabs

Click the **+** button in the terminal sidebar to create a new tab. Tabs can be:
- Named for easy identification
- Organized for different purposes (monitoring, SSH sessions, etc.)
- Persistent across restarts

### Tab Features

- **Rename** — Double-click the tab name
- **Duplicate** — Create a copy of the current session
- **Close** — Close the tab (session is preserved until explicitly destroyed)

## Terminal Features

### dtach Sessions

Terminals are backed by [dtach](https://github.com/crigler/dtach) sessions, providing:

- **Persistence** — Terminals survive server restarts
- **Detach/Attach** — Sessions continue running when you disconnect
- **Remote resilience** — Perfect for remote server setups

### Scrollback

Terminals maintain scrollback history. Scroll up to see previous output.

## Remote Terminals

When running Vibora on a remote server, terminals continue running even when you disconnect. This is one of Vibora's key benefits for AI agent orchestration.

See [Remote Server](/guide/remote-server) for setup instructions.
