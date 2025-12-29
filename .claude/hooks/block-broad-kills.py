#!/usr/bin/env python3
"""
Claude Code PreToolUse hook to block broad process kills.

Prevents commands like `pkill bun`, `killall vite`, etc. that could terminate
the production Vibora server or other agents' dev servers running in parallel.
"""
import json
import re
import sys

input_data = json.load(sys.stdin)

if input_data.get("tool_name") != "Bash":
    sys.exit(0)

command = input_data.get("tool_input", {}).get("command", "")

# Block broad bun/vite/node process kills
dangerous = [
    # pkill with -f flag (pattern match) for bun/vite/node
    r"pkill\s+(-\w+\s+)*-f\s+['\"]?bun",
    r"pkill\s+(-\w+\s+)*-f\s+['\"]?vite",
    r"pkill\s+(-\w+\s+)*-f\s+['\"]?node",
    # pkill by process name
    r"pkill\s+(-\w+\s+)*bun\b",
    r"pkill\s+(-\w+\s+)*vite\b",
    r"pkill\s+(-\w+\s+)*node\b",
    # killall
    r"killall\s+(-\w+\s+)*bun\b",
    r"killall\s+(-\w+\s+)*vite\b",
    r"killall\s+(-\w+\s+)*node\b",
    # kill with pgrep (kills all matching processes)
    r"kill\s+.*\$\(pgrep\s+(-\w+\s+)*bun",
    r"kill\s+.*\$\(pgrep\s+(-\w+\s+)*vite",
    r"kill\s+.*\$\(pgrep\s+(-\w+\s+)*node",
]

for pattern in dangerous:
    if re.search(pattern, command, re.IGNORECASE):
        print(json.dumps({
            "hookSpecificOutput": {
                "hookEventName": "PreToolUse",
                "permissionDecision": "deny",
                "permissionDecisionReason": (
                    "Blocked: broad process kills can terminate Vibora and other agents. "
                    "Use port-specific kills instead: kill $(lsof -t -i :PORT)"
                )
            }
        }))
        sys.exit(0)

sys.exit(0)
