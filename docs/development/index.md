# Development Setup

Get Vibora running locally for development.

## Prerequisites

- [mise](https://mise.jdx.dev/) for task running and tool management
- [Bun](https://bun.sh/) (installed automatically via mise)

## Getting Started

```bash
# Clone the repository
git clone https://github.com/knowsuchagency/vibora.git
cd vibora

# Install tools and dependencies
mise install

# Start both frontend and backend
mise run dev
```

Development mode uses `~/.vibora/dev` (port 6666) by default to keep development data separate from production.

## Available Tasks

```bash
mise run dev          # Start frontend and backend dev servers
mise run server       # Start backend dev server with auto-reload
mise run client       # Start frontend dev server
mise run build        # Build for production
mise run start        # Run production server
mise run up           # Build and start production server as daemon
mise run down         # Stop the daemon server
mise run check        # Run all checks (lint + typecheck)
mise run lint         # Run ESLint
mise run typecheck    # Check TypeScript types
mise run preview      # Preview production build
```

### Database Operations

```bash
mise run db:push      # Sync schema to database
mise run db:studio    # Open Drizzle Studio GUI
mise run db:generate  # Generate migrations
mise run db:migrate   # Apply migrations
```

### CLI Package

```bash
mise run cli:build    # Bundle server, copy frontend, generate migrations
mise run cli:publish  # Publish to npm (runs cli:build first)
```

### Version Management

```bash
mise run bump         # Bump patch version
mise run bump major   # Bump major version
mise run bump minor   # Bump minor version
```

## Database

- Default location: `~/.vibora/vibora.db` (SQLite with WAL mode)
- Schema: `server/db/schema.ts`

### Tables

| Table | Description |
|-------|-------------|
| `tasks` | Task metadata, git worktree paths, status, Linear integration, PR tracking |
| `repositories` | Saved git repositories with startupScript and copyFiles patterns |
| `terminalTabs` | First-class tab entities for terminal organization |
| `terminals` | Terminal instances with dtach session backing |
| `terminalViewState` | Singleton UI state persistence (active tab, focused terminals) |

Task statuses: `IN_PROGRESS`, `IN_REVIEW`, `DONE`, `CANCELED`

## Developer Mode

Developer mode enables additional features useful for Vibora development:

- **Restart Button** — A "Restart Vibora" button appears in Settings
- **Vibora Instances Tab** — Shows running Vibora instances in Monitoring

Enable with the `VIBORA_DEVELOPER` environment variable:

```bash
VIBORA_DEVELOPER=1 bun server/index.ts
```

## Systemd User Service

For remote development, run Vibora as a systemd user service. This allows restarting the server from within Vibora itself.

Create `~/.config/systemd/user/vibora.service`:

```ini
[Unit]
Description=Vibora Development Server
After=network.target

[Service]
Type=simple
WorkingDirectory=%h/vibora
ExecStartPre=mise run build:debug
ExecStartPre=bun run drizzle-kit push
ExecStartPre=mise run down
ExecStart=bun server/index.ts
Environment=VIBORA_DEVELOPER=1
Restart=always
RestartSec=5

[Install]
WantedBy=default.target
```

Then enable:

```bash
systemctl --user daemon-reload
systemctl --user enable vibora
systemctl --user start vibora
```

To keep the service running after logout:

```bash
loginctl enable-linger $USER
```
