# Terminal Internals

This document covers the terminal architecture, including dtach sessions, WebSocket protocol, and common pitfalls.

## Overview

Vibora's terminal system has three layers:

1. **Frontend** — xterm.js terminal emulator + MobX State Tree for state
2. **WebSocket** — Real-time I/O multiplexing between frontend and server
3. **Backend** — bun-pty for PTY management + dtach for persistence

## dtach Session Lifecycle

Terminals are backed by [dtach](https://github.com/crigler/dtach) for persistence. Understanding the lifecycle is critical:

### Creation (`dtach -n`)

```bash
dtach -n /path/to/socket /bin/bash
```

This:
1. Creates a Unix socket at the specified path
2. Spawns the shell as a child process
3. **Exits immediately** — the creation process is short-lived

### Attachment (`dtach -a`)

```bash
dtach -a /path/to/socket
```

This:
1. Connects to the existing socket
2. Establishes a long-lived connection
3. Forwards I/O between the PTY and the attached client

### Critical Insight

**Creation and attachment are separate processes.** The creation process exits right away—don't hold references to it expecting ongoing I/O.

## WebSocket Protocol

Terminal I/O is multiplexed over a single WebSocket connection at `/ws/terminal`.

### Message Types

**Client → Server:**

```typescript
// Attach to a terminal
{ type: "attach", terminalId: string }

// Send input to a terminal
{ type: "input", terminalId: string, data: string }

// Resize terminal
{ type: "resize", terminalId: string, cols: number, rows: number }

// Detach from a terminal
{ type: "detach", terminalId: string }
```

**Server → Client:**

```typescript
// Terminal output
{ type: "output", terminalId: string, data: string }

// Terminal created
{ type: "terminal:created", terminal: Terminal }

// Terminal destroyed
{ type: "terminal:destroyed", terminalId: string }

// Error
{ type: "error", terminalId?: string, message: string }
```

### Connection Flow

```
1. Client opens WebSocket to /ws/terminal
2. Client sends attach for each visible terminal
3. Server attaches to dtach sessions
4. Server streams buffered output
5. Ongoing I/O flows bidirectionally
6. On disconnect, server detaches but sessions persist
```

## MobX State Tree Model

The frontend uses MobX State Tree for terminal state:

```typescript
const Terminal = types.model("Terminal", {
  id: types.identifier,
  name: types.string,
  tabId: types.maybeNull(types.string),
  taskId: types.maybeNull(types.string),
  cwd: types.maybeNull(types.string),
  isAttached: types.optional(types.boolean, false),
})

const TerminalStore = types.model("TerminalStore", {
  terminals: types.map(Terminal),
  activeTerminalId: types.maybeNull(types.string),
})
```

### Optimistic Updates

When creating terminals, we use temporary IDs:

```typescript
// 1. Create with tempId
const tempId = `temp-${Date.now()}`
store.addTerminal({ id: tempId, name: "New Terminal" })

// 2. POST to server
const response = await createTerminal({ name: "New Terminal" })

// 3. Replace tempId with realId
store.replaceTerminalId(tempId, response.id)
```

## Buffer Management

The server maintains output buffers for each terminal:

```typescript
class BufferManager {
  private buffers: Map<string, string[]> = new Map()
  private maxLines = 10000

  append(terminalId: string, data: string) {
    // Split into lines, maintain max buffer size
  }

  getBuffer(terminalId: string): string {
    // Return buffered output for replay on attach
  }
}
```

When a client attaches, buffered output is replayed to show recent history.

## Common Pitfalls

### Blank Screen Race Condition

**Symptom:** Terminal shows blank screen, especially in desktop app.

**Cause:** Race condition between `start()` and `attach()` in TerminalSession.

**Root cause:** The `start()` method stored the short-lived `dtach -n` PTY in `this.pty`. When `attach()` checked `if (this.pty) return`, it bailed out thinking attachment already happened.

**Fix:** Use a local variable in `start()` for the creation PTY. Only `attach()` should set `this.pty`.

**Lesson:** Never conflate the creation process with the attachment process.

### Zombie dtach Sockets

**Symptom:** "Socket already exists" errors.

**Cause:** dtach socket file left behind after unclean shutdown.

**Fix:** Check for stale sockets and clean up:

```typescript
if (fs.existsSync(socketPath)) {
  // Try to connect—if it fails, the socket is stale
  try {
    // Attempt connection
  } catch {
    fs.unlinkSync(socketPath)
  }
}
```

### Output Buffering Gaps

**Symptom:** Missing output when attaching to a terminal.

**Cause:** Output generated between server start and client attachment may be lost if buffering isn't enabled.

**Fix:** Always buffer output from the moment the PTY is created, not just when a client attaches.

## Debugging

### View Terminal Logs

```bash
grep '"src":"PTYManager"' ~/.vibora/vibora.log | tail -50
grep '"src":"TerminalSession"' ~/.vibora/vibora.log | tail -50
```

### Check dtach Sockets

```bash
ls -la ~/.vibora/worktrees/*/sockets/
```

### Debug WebSocket Messages

Enable debug logging:

```bash
DEBUG=1 mise run dev
```

Then check browser console for WebSocket message logs.
