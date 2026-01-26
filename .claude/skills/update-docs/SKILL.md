---
name: update-docs
description: Update documentation files (README.md, CLAUDE.md, assistant-knowledge.ts) based on code changes since they were last committed. Stops if git status is dirty.
disable-model-invocation: true
argument-hint: "[optional: specific files to update]"
allowed-tools: Bash, Read, Write, Edit, Grep, Glob
---

# Update Documentation

Update documentation files based on code changes since they were last modified.

## Pre-flight Check

**CRITICAL: Check git status first. If the working tree is dirty, stop immediately.**

```bash
git status --porcelain
```

If this outputs anything, STOP and tell the user:
> "Working tree is dirty. Please commit or stash your changes before running /update-docs."

Do NOT proceed with any documentation updates if there are uncommitted changes.

## Files to Update

Default documentation files (unless overridden by $ARGUMENTS):

1. **README.md** - Project overview, features, installation, usage
2. **CLAUDE.md** - Development guide, architecture, commands, database schema
3. **server/services/assistant-knowledge.ts** - AI assistant's Fulcrum expertise

If user provides arguments: $ARGUMENTS

## Update Process

For each documentation file:

### 1. Find Changes Since Last Doc Commit

Get the last commit that modified this specific doc file:

```bash
git log -1 --format="%H" -- <doc-file>
```

Then find all code changes since that commit:

```bash
git diff <last-doc-commit>..HEAD --stat
git log --oneline <last-doc-commit>..HEAD
```

### 2. Analyze What Changed

Look at the commits and diffs to understand:
- New features or capabilities added
- Architecture changes (new services, routes, components)
- Database schema changes (new tables, columns)
- Configuration changes (new settings, environment variables)
- CLI changes (new commands, options)
- Removed or deprecated features

### 3. Update Each File

#### README.md Updates
- Feature list if new features were added
- Installation steps if dependencies changed
- Usage examples if CLI changed
- Screenshots section if UI changed significantly
- Architecture diagram if structure changed

#### CLAUDE.md Updates
- Development commands if mise tasks changed
- Architecture section if services/routes added
- Database tables section if schema changed
- Configuration section if settings changed
- File organization if directory structure changed

#### assistant-knowledge.ts Updates
- `getDataModel()` if database schema changed
- `getMcpToolCapabilities()` if MCP tools added/changed
- `getOrchestrationCapabilities()` if new CLI capabilities
- `getProblemSolvingPatterns()` if new use cases enabled
- `getCondensedKnowledge()` to reflect major changes

### 4. Read Before Writing

ALWAYS read the current content of each file before making changes:
- Understand the existing structure
- Preserve formatting and style
- Only update sections that are actually affected by code changes
- Don't rewrite unchanged sections

### 5. Be Conservative

- Only update what actually changed
- Don't add speculative documentation
- Don't remove content unless the feature was removed
- Preserve existing examples unless they're now incorrect

## Output

After updating, provide a summary:

1. List each file that was updated
2. For each file, list the sections that were modified
3. Note any sections that might need manual review
4. Show the git diff of documentation changes

## Example Workflow

```
1. Check git status → clean ✓
2. README.md last updated at commit abc123
   - 15 commits since then
   - Notable: added WhatsApp integration, new CLI commands
   - Updated: Features section, CLI usage section
3. CLAUDE.md last updated at commit def456
   - 8 commits since then
   - Notable: new messaging service, schema changes
   - Updated: Architecture section, Database tables
4. assistant-knowledge.ts last updated at commit ghi789
   - 3 commits since then
   - Notable: new MCP tools
   - Updated: getMcpToolCapabilities()

Summary:
- README.md: Updated features list, added WhatsApp to integrations
- CLAUDE.md: Added messaging service docs, updated schema table
- assistant-knowledge.ts: Added messaging tools to MCP section
```
