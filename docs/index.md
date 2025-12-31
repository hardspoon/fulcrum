---
layout: home

hero:
  name: Vibora
  text: The Vibe Engineer's Cockpit
  tagline: Orchestrate Claude Code across parallel workstreams from a terminal-first command center
  image:
    src: /logo.png
    alt: Vibora
  actions:
    - theme: brand
      text: Get Started
      link: /guide/quick-start
    - theme: alt
      text: View on GitHub
      link: https://github.com/knowsuchagency/vibora

features:
  - icon: 🖥️
    title: Parallel Agent Orchestration
    details: Run multiple Claude Code sessions across different tasks and worktrees. See and control all sessions in one parallel view.
  - icon: 🌐
    title: Local or Remote Execution
    details: Run on your machine or a remote server. Launch tasks, close your laptop, and your agents keep working.
  - icon: 🌲
    title: Git Worktree Isolation
    details: Each task runs in its own worktree. Your main branch stays clean until you're ready to merge.
  - icon: 🤖
    title: Deep Claude Integration
    details: Plugin with automatic status sync and task management. MCP server lets Claude manage tasks directly.
  - icon: 📋
    title: Kanban Task Management
    details: Visual task tracking from planning to done. Tasks automatically spin up isolated git worktrees.
  - icon: 🔗
    title: Linear & GitHub Integration
    details: Sync task status with Linear tickets. Monitor PRs across all your repositories.
---

## What It Does

**Vibora is for developers who take Claude Code seriously.** Not as a novelty, but as their primary interface for getting things done. If you live in the terminal and want to run multiple Claude Code sessions across isolated workstreams, Vibora is your cockpit.

## Quick Start

```bash
npx vibora@latest up
```

Open [http://localhost:7777](http://localhost:7777) in your browser.

That's it! Vibora will check for dependencies, offer to install any that are missing, and start the server.

[Get Started →](/guide/quick-start)
