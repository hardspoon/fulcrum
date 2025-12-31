# Remote Server Setup

Run the backend on a remote server and connect from anywhere. Launch tasks, close your laptop, and your agents keep working.

## Why Remote?

As AI becomes more capable of autonomous work, running agents on a remote server becomes essential:

- **Persistence** — Agents continue working when you disconnect
- **Resources** — Use a more powerful machine for compute-intensive tasks
- **Availability** — Access your workspace from anywhere
- **Reliability** — Server stays up even when your laptop sleeps

## Desktop App: SSH Port Forwarding

The desktop app connects to `localhost:7777`. Use SSH port forwarding to tunnel to your remote server.

### Basic Forwarding

```bash
# Forward local port 7777 to remote server's port 7777
ssh -L 7777:localhost:7777 your-server
```

### Background with Keep-Alive

```bash
ssh -fN -o ServerAliveInterval=30 -o ServerAliveCountMax=3 \
    -L 7777:localhost:7777 your-server
```

### On the Remote Server

Start Vibora:

```bash
npx vibora@latest up
```

The desktop app will connect through the tunnel automatically.

### Benefits

- **Secure** — Backend stays bound to localhost, no exposed ports
- **Performant** — Direct SSH connection, lower latency than overlay networks
- **Simple** — No additional configuration needed

### Persistent Tunnel on macOS

For a tunnel that survives reboots, create a launchd agent. See [this guide](https://gist.github.com/knowsuchagency/60656087903cd56d3a9b5d1d5c803186).

## Browser: Tailscale or Cloudflare Tunnels

For browser-only access, use Tailscale or Cloudflare Tunnels to expose your server.

### Tailscale

1. Install Tailscale on both machines
2. Start Vibora on the remote server:
   ```bash
   npx vibora@latest up
   ```
3. Access via browser:
   ```
   http://your-server.tailnet.ts.net:7777
   ```

### Cloudflare Tunnels

Use `cloudflared` to create a tunnel to your Vibora server. This provides a public URL with Cloudflare's security features.

## Running as a Service

For production deployments, run Vibora as a systemd service.

### User Service

Create `~/.config/systemd/user/vibora.service`:

```ini
[Unit]
Description=Vibora Server
After=network.target

[Service]
Type=simple
WorkingDirectory=%h
ExecStart=/usr/local/bin/vibora up
Restart=always
RestartSec=5

[Install]
WantedBy=default.target
```

Enable and start:

```bash
systemctl --user daemon-reload
systemctl --user enable vibora
systemctl --user start vibora
```

### Enable Lingering

To keep the service running after logout:

```bash
sudo loginctl enable-linger $USER
```

## Configuration

Remote servers often need custom configuration:

```bash
# Set a custom port
vibora config set server.port 8080

# Bind to all interfaces (if using Tailscale)
# Note: This exposes the server on all network interfaces
HOST=0.0.0.0 vibora up
```

See [Configuration](/reference/configuration) for all options.
