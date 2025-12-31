# Tasks & Worktrees

Tasks are the core unit of work in Vibora. Each task represents a piece of work that runs in an isolated git worktree.

## How Tasks Work

When you create a task:

1. **A new git worktree is created** from your repository's main branch
2. **A terminal is opened** in the worktree directory
3. **The task appears on the Kanban board** in the "In Progress" column
4. **Status syncs automatically** when using the Claude Code plugin

## Task States

| Status | Description |
|--------|-------------|
| **In Progress** | Active work happening |
| **In Review** | Waiting for review or approval |
| **Done** | Work completed |
| **Canceled** | Task abandoned |

With the Claude Code plugin installed, status changes automatically:
- When Claude stops and waits for input → **In Review**
- When you respond to Claude → **In Progress**

## Creating Tasks

### From the Repositories View

1. Navigate to **Repositories**
2. Click **New Task** on the repository
3. Enter a task name
4. Optionally link to a Linear ticket

### From the CLI

```bash
vibora tasks create
```

## Managing Tasks

### Kanban Board

The Kanban board shows all tasks organized by status. Drag tasks between columns or use the task menu for actions.

### Task Terminals View

See all Claude Code sessions across every task in one parallel view. This is the killer feature for orchestrating multiple agents.

### CLI Commands

```bash
vibora tasks list                # List all tasks
vibora tasks get <id>            # Get task by ID
vibora tasks move <id>           # Move to different status
vibora tasks delete <id>         # Delete a task
```

When inside a task worktree:

```bash
vibora current-task              # Get current task info
vibora current-task review       # Mark as IN_REVIEW
vibora current-task done         # Mark as DONE
vibora current-task pr <url>     # Associate a PR
```

## Git Worktrees

Each task runs in its own [git worktree](https://git-scm.com/docs/git-worktree). This provides:

- **Isolation** — Changes in one task don't affect others
- **Clean main branch** — Your main branch stays untouched
- **Easy cleanup** — Delete the task and the worktree is removed
- **Parallel work** — Work on multiple features simultaneously

### Worktree Location

Worktrees are created in `~/.vibora/worktrees/` by default (or `$VIBORA_DIR/worktrees/`).

### Worktree Commands

```bash
vibora worktrees list            # List all worktrees
vibora worktrees delete          # Delete a worktree
```

## Linking to Linear

Link a task to a Linear ticket for automatic status sync:

```bash
vibora current-task linear https://linear.app/team/issue/TEAM-123
```

When task status changes in Vibora, the linked Linear ticket updates automatically.

## Associating Pull Requests

Link a PR to your task:

```bash
vibora current-task pr https://github.com/org/repo/pull/123
```

PRs are visible on the task card and in the PR Review view.
