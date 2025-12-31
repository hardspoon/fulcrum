# REST API

Vibora exposes a REST API for programmatic access to task management and server features.

## Base URL

```
http://localhost:7777/api
```

## Authentication

The API currently does not require authentication. When running on a remote server, secure access via SSH tunneling or reverse proxy.

## Tasks

### List Tasks

```http
GET /api/tasks
```

**Query Parameters:**
| Name | Type | Description |
|------|------|-------------|
| `status` | string | Filter by status |
| `repositoryId` | string | Filter by repository |

**Response:**
```json
[
  {
    "id": "abc123",
    "title": "Add authentication",
    "status": "IN_PROGRESS",
    "repositoryId": "repo456",
    "worktreePath": "/home/user/.vibora/worktrees/task-abc123",
    "createdAt": "2024-01-15T10:30:00Z",
    "updatedAt": "2024-01-15T14:20:00Z"
  }
]
```

### Get Task

```http
GET /api/tasks/:id
```

**Response:**
```json
{
  "id": "abc123",
  "title": "Add authentication",
  "description": "Implement user login and registration",
  "status": "IN_PROGRESS",
  "repositoryId": "repo456",
  "worktreePath": "/home/user/.vibora/worktrees/task-abc123",
  "prUrl": "https://github.com/org/repo/pull/42",
  "linearUrl": "https://linear.app/team/issue/TEAM-123",
  "createdAt": "2024-01-15T10:30:00Z",
  "updatedAt": "2024-01-15T14:20:00Z"
}
```

### Create Task

```http
POST /api/tasks
```

**Body:**
```json
{
  "title": "Add authentication",
  "description": "Implement user login",
  "repositoryId": "repo456",
  "baseBranch": "main"
}
```

### Update Task

```http
PATCH /api/tasks/:id
```

**Body:**
```json
{
  "title": "Updated title",
  "description": "Updated description"
}
```

### Update Task Status

```http
PATCH /api/tasks/:id/status
```

**Body:**
```json
{
  "status": "IN_REVIEW"
}
```

### Delete Task

```http
DELETE /api/tasks/:id
```

## Repositories

### List Repositories

```http
GET /api/repositories
```

**Response:**
```json
[
  {
    "id": "repo456",
    "name": "my-project",
    "path": "/home/user/projects/my-project",
    "defaultBranch": "main"
  }
]
```

### Get Repository

```http
GET /api/repositories/:id
```

### Create Repository

```http
POST /api/repositories
```

**Body:**
```json
{
  "path": "/home/user/projects/my-project"
}
```

### Delete Repository

```http
DELETE /api/repositories/:id
```

## Terminals

### List Terminals

```http
GET /api/terminals
```

### Create Terminal

```http
POST /api/terminals
```

**Body:**
```json
{
  "name": "My Terminal",
  "cwd": "/home/user/projects"
}
```

### Delete Terminal

```http
DELETE /api/terminals/:id
```

## Worktrees

### List Worktrees

```http
GET /api/worktrees
```

### Delete Worktree

```http
DELETE /api/worktrees/:path
```

## Git Operations

### Repository Status

```http
GET /api/git/status?path=/path/to/repo
```

### Repository Diff

```http
GET /api/git/diff?path=/path/to/repo
```

### List Branches

```http
GET /api/git/branches?path=/path/to/repo
```

## Notifications

### Send Notification

```http
POST /api/notifications
```

**Body:**
```json
{
  "title": "Task Complete",
  "message": "Authentication feature is ready for review"
}
```

## Health

### Health Check

```http
GET /api/health
```

**Response:**
```json
{
  "status": "ok",
  "version": "1.0.0"
}
```

## WebSocket

Terminal I/O is handled via WebSocket:

```
ws://localhost:7777/ws/terminal
```

### Protocol

Messages are JSON-encoded:

```json
{
  "type": "input",
  "terminalId": "term123",
  "data": "ls -la\n"
}
```

```json
{
  "type": "output",
  "terminalId": "term123",
  "data": "total 48\ndrwxr-xr-x..."
}
```

## Error Responses

Errors return appropriate HTTP status codes with a JSON body:

```json
{
  "error": "Task not found",
  "code": "NOT_FOUND"
}
```

| Status | Description |
|--------|-------------|
| 400 | Bad Request — Invalid input |
| 404 | Not Found — Resource doesn't exist |
| 500 | Internal Server Error |
