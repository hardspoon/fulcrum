# Quick Start

Get Vibora running in under a minute.

## Installation

### Using npx (Recommended)

```bash
npx vibora@latest up
```

Vibora will:
- Check for required dependencies (bun, dtach, Claude Code, uv)
- Offer to install any that are missing
- Start the server on http://localhost:7777
- Show getting started tips

Open [http://localhost:7777](http://localhost:7777) in your browser.

### Check Your Setup

```bash
vibora doctor
```

Shows the status of all dependencies with versions.

### Desktop App

Download the desktop app for a bundled experience:

| Platform | Download |
|----------|----------|
| **macOS** (Apple Silicon) | [Download DMG](https://github.com/knowsuchagency/vibora/releases/latest/download/Vibora-macos-arm64.dmg) |
| **Linux** | [Download AppImage](https://github.com/knowsuchagency/vibora/releases/latest/download/Vibora-linux-x64.AppImage) |

The desktop app bundles everything—just install and run. It will start the server, install the Claude Code plugin, and check for updates automatically.

::: details macOS Installation Notes
1. Open the DMG and drag Vibora to Applications
2. On first launch, macOS will block the app
3. Open **System Settings → Privacy & Security**, scroll down, and click **Open Anyway**
4. Confirm by clicking **Open Anyway** in the dialog
:::

### Install Script

For automated installation (useful for remote servers):

```bash
curl -fsSL https://raw.githubusercontent.com/knowsuchagency/vibora/main/install.sh | bash
```

## Install the Claude Code Plugin

For automatic status sync and task management:

```bash
claude plugin marketplace add knowsuchagency/vibora
claude plugin install vibora@vibora --scope user
```

The plugin enables:
- **Automatic Status Sync** — Task moves to "In Review" when Claude stops, "In Progress" when you respond
- **Slash Commands** — `/review`, `/pr`, `/notify`, `/linear`, `/task-info`
- **MCP Server** — Task management tools available directly to Claude

## Creating Your First Task

1. Navigate to the **Repositories** view and add a repository
2. Click **New Task** on the repository
3. Enter a task name (e.g., "Add user authentication")
4. Vibora creates an isolated git worktree and opens a terminal

Your task is now running in its own worktree. You can:
- Open it in your editor
- Start Claude Code in the terminal
- Track progress on the Kanban board

## Next Steps

- [Tasks & Worktrees](/guide/tasks) - Learn about task management
- [Remote Server](/guide/remote-server) - Run agents on a remote server
- [Claude Plugin](/guide/claude-plugin) - Deep integration with Claude Code
