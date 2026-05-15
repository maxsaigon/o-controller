# O-Control: Ubuntu 24.04 / N100 Deployment Runbook

This document describes how to deploy O-Control on an Intel N100 Mini PC running Ubuntu 24.04 LTS.

## Prerequisites

- Mini PC with Intel N100 (or equivalent) running Ubuntu 24.04 LTS
- Docker Engine and Docker Compose V2 installed
- Network access to the Onkyo CR-N775 on the same LAN
- CR-N775 set to a static IP (via router DHCP reservation or receiver settings)
- `Network Standby` enabled on the CR-N775 (Settings -> Network -> Network Standby -> On)

## 1. Install Docker

```bash
# Update system
sudo apt update && sudo apt upgrade -y

# Install Docker using the official convenience script
curl -fsSL https://get.docker.com | sudo sh

# Add your user to the docker group
sudo usermod -aG docker $USER

# Install Docker Compose plugin (V2)
sudo apt install -y docker-compose-plugin

# Verify
docker --version
docker compose version

# Log out and back in for group changes to take effect
```

## 2. Clone the Repository

```bash
cd /opt
sudo mkdir -p o-control && sudo chown $USER:$USER o-control
git clone https://github.com/maxsaigon/o-controller.git o-control
cd o-control
```

## 3. Configure Environment

```bash
cp .env.example .env
```

Edit `.env` with your receiver's actual IP:

```bash
nano .env
```

Required values:

```env
ONKYO_HOST=192.168.1.104    # Your CR-N775 static IP
ONKYO_PORT=60128             # Default eISCP port
O_CONTROL_PORT=8787          # Service API port
LOG_LEVEL=info               # info for production, debug for troubleshooting
MOCK_MODE=false              # Must be false for real receiver
```

## 4. Verify Network Connectivity

Before deploying, confirm the Mini PC can reach the receiver:

```bash
# Test TCP connectivity to eISCP port
nc -zv 192.168.1.104 60128

# Expected output: Connection to 192.168.1.104 60128 port [tcp/*] succeeded!
```

If this fails:
- Check that CR-N775 is powered on (or Network Standby is enabled)
- Check that both devices are on the same subnet
- Check router firewall rules

## 5. Build and Start

Recommended deployment model:
- Development and UI verification run on the Mac with host Node.
- Docker Compose on the Mac is used only for occasional smoke tests.
- Production should eventually pull a prebuilt image from CI/GHCR, so the N100 does not spend time installing Node dependencies or compiling TypeScript.

The current Compose file still supports local builds, which is useful before CI image publishing is wired up:

```bash
cd /opt/o-control

# Build the Docker image
docker compose -f infra/docker/docker-compose.yml build

# Start the service
docker compose -f infra/docker/docker-compose.yml up -d

# Verify it started
docker compose -f infra/docker/docker-compose.yml ps
docker compose -f infra/docker/docker-compose.yml logs -f --tail=20
```

### Local Compose Smoke Result

Verified on 2026-05-15 from the project workspace:

```bash
COMPOSE_PROJECT_NAME=o-control-smoke O_CONTROL_PORT=18787 MOCK_MODE=true LOG_LEVEL=silent docker compose -f infra/docker/docker-compose.yml up -d --build
curl http://127.0.0.1:18787/health
COMPOSE_PROJECT_NAME=o-control-smoke O_CONTROL_PORT=18787 MOCK_MODE=true LOG_LEVEL=silent docker compose -f infra/docker/docker-compose.yml down
```

Health response:

```json
{"status":"ok","connected":true,"mockMode":true,"uptime":5.406830211}
```

The smoke run builds the service image, starts it in mock mode, verifies the HTTP health endpoint through Docker port mapping, and removes the container/network afterwards.

Local Docker builds on macOS can be slow the first time because Docker pulls the Node base image and installs workspace dependencies inside Linux. Subsequent runs should be faster because the Dockerfile uses BuildKit npm cache mounts and `.dockerignore` keeps UI, docs screenshots, tests, and Tauri build output out of the Docker context. If local iteration is still slow, keep using `npm run dev:service` for development and reserve `docker compose ... up -d --build` for release checks.

## 6. Verify Service

```bash
# Health check
curl http://localhost:8787/health

# Expected:
# {"status":"ok","connected":true,"mockMode":false,"uptime":...}

# Query state
curl http://localhost:8787/state

# Test a command
curl -X POST http://localhost:8787/commands/power -H 'Content-Type: application/json' -d '{"action":"toggle"}'
```

## 7. Firewall Configuration

If using `ufw`:

```bash
# Allow O-Control API access from LAN only
sudo ufw allow from 192.168.1.0/24 to any port 8787 proto tcp comment "O-Control API"

# Verify
sudo ufw status
```

**Do not expose port 8787 to the internet.** Use Tailscale for remote access.

## 8. Tailscale (Optional Remote Access)

```bash
# Install Tailscale
curl -fsSL https://tailscale.com/install.sh | sh
sudo tailscale up

# O-Control will be accessible at:
# http://<tailscale-ip>:8787
# or http://<hostname>.tailnet-name.ts.net:8787
```

## 9. Systemd Auto-Start

Docker Compose with `restart: unless-stopped` handles container restarts, but ensure Docker itself starts on boot:

```bash
sudo systemctl enable docker
sudo systemctl is-enabled docker
# Should output: enabled
```

## 10. Monitoring with Netdata (Optional)

```bash
# Install Netdata for container monitoring
wget -O /tmp/netdata-kickstart.sh https://get.netdata.cloud/kickstart.sh
sh /tmp/netdata-kickstart.sh --stable-channel

# Netdata dashboard: http://<ip>:19999
# Docker container metrics appear automatically
```

## 11. Updating

```bash
cd /opt/o-control
git pull
docker compose -f infra/docker/docker-compose.yml build --no-cache
docker compose -f infra/docker/docker-compose.yml up -d
```

## 12. Troubleshooting

### Service starts but shows `connected: false`

```bash
# Check logs
docker compose -f infra/docker/docker-compose.yml logs o-control

# Common causes:
# - Wrong ONKYO_HOST in .env
# - CR-N775 not powered on / Network Standby disabled
# - Firewall blocking outbound TCP to port 60128
# - Docker using bridge network and can't reach LAN device
```

If Docker bridge network can't reach the receiver, use host networking:

```bash
# Edit docker-compose.yml, uncomment:
# network_mode: host

# Then restart
docker compose -f infra/docker/docker-compose.yml up -d
```

### Service shows reconnect loops

The service automatically reconnects with exponential backoff (1s -> 2s -> 4s -> ... -> 30s max). This is normal when:
- The receiver is in deep standby (not Network Standby)
- There's a temporary network interruption
- The receiver was physically powered off

### Container keeps restarting

```bash
docker compose -f infra/docker/docker-compose.yml logs --tail=50 o-control

# Check for startup errors like missing env vars or port conflicts
```

### Volume levels seem wrong

The CR-N775 volume range is 0x00-0x64 (0-100 decimal). Some models cap lower. If volume 100 is too loud, adjust preset definitions to use a lower max.

## 13. Resource Usage

On an Intel N100 Mini PC, O-Control uses minimal resources:
- **CPU:** <1% idle, brief spikes on command execution
- **Memory:** ~50-80 MB for the Node.js container
- **Disk:** ~200 MB for the Docker image
- **Network:** Minimal - persistent TCP connection + occasional HTTP requests
