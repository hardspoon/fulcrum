# Architecture

Vibora follows a client-server architecture with a React frontend and Hono.js backend, both running on Bun.

## Overview

```
┌─────────────────────────────────────────────────────────────┐
│                        Clients                               │
├─────────────────┬─────────────────┬─────────────────────────┤
│   Desktop App   │   Web Browser   │      CLI / MCP          │
│  (Neutralino)   │                 │                          │
└────────┬────────┴────────┬────────┴──────────┬──────────────┘
         │                 │                    │
         │     HTTP/WS     │                    │ HTTP
         └────────┬────────┘                    │
                  ▼                             ▼
┌─────────────────────────────────────────────────────────────┐
│                      Vibora Server                           │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────┐  │
│  │  REST API   │  │  WebSocket  │  │    MCP Server       │  │
│  │   /api/*    │  │ /ws/terminal│  │    (stdio)          │  │
│  └──────┬──────┘  └──────┬──────┘  └──────────┬──────────┘  │
│         │                │                     │             │
│         ▼                ▼                     │             │
│  ┌─────────────────────────────────────────────────────────┐│
│  │                    Services                              ││
│  │  ┌────────┐ ┌────────┐ ┌────────┐ ┌────────────────────┐││
│  │  │  Task  │ │Terminal│ │  Git   │ │   Integrations    │││
│  │  │Manager │ │Manager │ │ Ops    │ │(Linear, GitHub)   │││
│  │  └────┬───┘ └────┬───┘ └────────┘ └────────────────────┘││
│  │       │          │                                       ││
│  │       │          ▼                                       ││
│  │       │    ┌──────────┐                                  ││
│  │       │    │   PTY    │ ◄──── dtach sessions             ││
│  │       │    │ Manager  │                                  ││
│  │       │    └──────────┘                                  ││
│  │       │                                                  ││
│  │       ▼                                                  ││
│  │  ┌─────────────────────────────────────────────────────┐ ││
│  │  │                  SQLite + Drizzle                   │ ││
│  │  └─────────────────────────────────────────────────────┘ ││
│  └──────────────────────────────────────────────────────────┘│
└─────────────────────────────────────────────────────────────┘
```

## Frontend

**Stack:** React 19, TanStack Router, TanStack Query, shadcn/ui, xterm.js, MobX State Tree

### File Structure

```
frontend/
├── routes/              # Pages (TanStack Router file-based)
│   ├── __root.tsx       # Root layout
│   ├── index.tsx        # Kanban board
│   ├── terminals.tsx    # Task terminals view
│   ├── tabs.tsx         # Persistent terminal tabs
│   ├── repositories.tsx # Repository management
│   ├── review.tsx       # PR review
│   ├── monitoring.tsx   # System monitoring
│   ├── settings.tsx     # Settings
│   └── worktrees.tsx    # Worktree management
├── components/
│   ├── kanban/          # Kanban board components
│   ├── terminal/        # Terminal components (xterm.js)
│   ├── viewer/          # File/content viewers
│   └── ui/              # shadcn/ui components
├── hooks/               # Custom hooks
│   ├── use-tasks.ts     # Task queries and mutations
│   ├── use-terminal-ws.ts  # WebSocket connection
│   └── ...
├── stores/              # MobX State Tree stores
│   ├── terminal-store.ts
│   └── tab-store.ts
└── lib/                 # Utilities
    └── logger.ts        # Frontend logging
```

### Key Patterns

- **File-based routing** — Routes are defined by file structure in `routes/`
- **Server state with React Query** — Tasks, repositories, etc. are fetched and cached
- **Local state with MST** — Terminal UI state uses MobX State Tree for real-time updates
- **WebSocket for terminals** — Terminal I/O is multiplexed over a single WebSocket

## Backend

**Stack:** Hono.js, Bun, SQLite, Drizzle ORM, bun-pty

### File Structure

```
server/
├── index.ts             # Entry point
├── routes/
│   ├── tasks.ts         # Task CRUD
│   ├── repositories.ts  # Repository management
│   ├── terminals.ts     # Terminal management
│   ├── git.ts           # Git operations
│   └── ...
├── services/
│   ├── pr-monitor.ts    # GitHub PR monitoring
│   ├── linear.ts        # Linear integration
│   ├── task-status.ts   # Task status management
│   └── notifications.ts # Notification dispatch
├── terminal/
│   ├── pty-manager.ts   # PTY lifecycle
│   ├── terminal-session.ts  # dtach session wrapper
│   └── buffer-manager.ts    # Output buffering
├── websocket/
│   └── terminal-handler.ts  # WebSocket protocol
├── db/
│   ├── schema.ts        # Drizzle schema
│   └── init.ts          # Database initialization
└── lib/
    ├── settings.ts      # Configuration management
    └── logger.ts        # Backend logging
```

### Key Patterns

- **REST for CRUD** — Standard REST endpoints for tasks, repositories, etc.
- **WebSocket for streaming** — Terminal I/O uses WebSocket for real-time data
- **dtach for persistence** — Terminal sessions backed by dtach for survival across restarts
- **Drizzle for database** — Type-safe SQL queries with Drizzle ORM

## Data Flows

### Task Creation

```
1. User clicks "New Task" in UI
2. POST /api/tasks with title, repositoryId
3. Server creates git worktree
4. Server creates database record
5. Server creates terminal for task
6. Response returns task with worktreePath
7. UI navigates to task terminal
```

### Terminal I/O

```
1. Client connects to ws://localhost:7777/ws/terminal
2. Client sends: { type: "attach", terminalId: "abc123" }
3. Server attaches to dtach session
4. Server streams: { type: "output", terminalId: "abc123", data: "..." }
5. Client sends: { type: "input", terminalId: "abc123", data: "ls\n" }
6. Server writes to PTY
7. Server streams output back
```

### Status Sync

```
1. Claude Code plugin detects session stop
2. Plugin calls: vibora current-task review
3. CLI sends PATCH /api/tasks/:id/status
4. Server updates database
5. If Linear linked, server updates Linear ticket
6. WebSocket broadcasts update to all clients
7. UI updates Kanban board
```

## CLI Package

The CLI bundles the server for distribution via npm:

```
cli/
├── src/
│   └── index.ts         # CLI entry point
├── server/
│   └── index.js         # Bundled server (generated)
├── dist/                # Frontend build (generated)
├── drizzle/             # SQL migrations (generated)
└── lib/
    └── librust_pty.so   # Native PTY library (generated)
```

Built with `mise run cli:build`, the CLI is a standalone package that can run anywhere with Bun installed.
