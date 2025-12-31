# Desktop App

The Vibora desktop app provides a bundled, native experience for macOS and Linux.

## Download

| Platform | Download |
|----------|----------|
| **macOS** (Apple Silicon) | [Download DMG](https://github.com/knowsuchagency/vibora/releases/latest/download/Vibora-macos-arm64.dmg) |
| **Linux** | [Download AppImage](https://github.com/knowsuchagency/vibora/releases/latest/download/Vibora-linux-x64.AppImage) |

## What's Included

The desktop app bundles:

- **Vibora server** — No separate installation needed
- **Frontend application** — Native window experience
- **Claude Code plugin** — Automatically installed on first run
- **Auto-updates** — Notifies when new versions are available

## Installation

### macOS

1. Open the DMG file
2. Drag Vibora to your Applications folder
3. On first launch, macOS will block the app (it's not notarized)
4. Open **System Settings → Privacy & Security**
5. Scroll down and click **Open Anyway**
6. Confirm by clicking **Open Anyway** in the dialog

### Linux

1. Download the AppImage
2. Make it executable:
   ```bash
   chmod +x Vibora-*.AppImage
   ```
3. Run it:
   ```bash
   ./Vibora-*.AppImage
   ```

For desktop integration, consider using [AppImageLauncher](https://github.com/TheAssassin/AppImageLauncher).

## Features

### Auto-Start Server

When you launch the app, it automatically:

1. Checks for the bundled server
2. Starts the server on port 7777
3. Installs the Claude Code plugin
4. Opens the main window

### Remote Connection

The desktop app can connect to a remote Vibora server via SSH port forwarding:

```bash
ssh -L 7777:localhost:7777 your-server
```

The app connects to `localhost:7777` and tunnels through to the remote server. See [Remote Server](/guide/remote-server) for details.

### Update Notifications

The app checks for updates on launch and notifies you when a new version is available. Updates are downloaded from GitHub Releases.

## Troubleshooting

### macOS Security Block

If macOS blocks the app:

1. Open **System Settings → Privacy & Security**
2. Find the Vibora entry near the bottom
3. Click **Open Anyway**

### Server Won't Start

Check if port 7777 is already in use:

```bash
lsof -i :7777
```

If another Vibora instance is running, stop it:

```bash
vibora down
```

### Plugin Not Working

Reinstall the plugin manually:

```bash
claude plugin install vibora@vibora --scope user
```

### View Logs

Logs are stored in `~/.vibora/`:

- `server.log` — Server stdout/stderr
- `vibora.log` — Application logs (JSONL format)

View recent errors:

```bash
grep '"lvl":"error"' ~/.vibora/vibora.log | tail -20
```
