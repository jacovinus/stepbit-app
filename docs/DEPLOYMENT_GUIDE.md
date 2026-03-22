# Stepbit Deployment Guide 🚀

This guide explains how to deploy Stepbit in production environments, both with and without Docker.

---

## 🏗 Option 1: Standalone Binary (Non-Docker)
Go allows you to compile Stepbit into a single high-performance binary that you can run directly on a server.

### 1. Build the Release Binary
On your build machine (or server):
```bash
go build -o stepbit-app ./cmd/stepbit-app
```
The resulting binary will be at `./stepbit-app`.

### 2. Create a Deployment Bundle 📦
To run Stepbit on a remote server, you need three things:
1.  **The Binary**: `stepbit-app`
2.  **Configuration**: `config.yaml`
3.  **Frontend Assets**: the built `web/dist/` bundle if you are serving prebuilt static files separately.

**Structure:**
```text
deploy/
├── stepbit-app   (the binary)
├── config.yaml   (your production config)
└── web-dist/     (optional prebuilt frontend bundle)
```

### 3. Running as a System Service (Linux)
To keep Stepbit running in the background, use a `systemd` unit:

**`/etc/systemd/system/stepbit.service`**
```ini
[Unit]
Description=Stepbit LLM Server
After=network.target

[Service]
Type=simple
User=youruser
WorkingDirectory=/home/youruser/stepbit
ExecStart=/home/youruser/stepbit/stepbit-app
Restart=always
Environment=JACOX_SERVER_HOST=0.0.0.0
Environment=OPENAI_API_KEY=sk-...

[Install]
WantedBy=multi-user.target
```

---

## 🐳 Option 2: Docker Compose (Recommended)
The easiest way to deploy with all dependencies (DuckDB, OpenSSL) pre-configured.

### 🚀 Launch
```bash
docker compose up -d
```
Your data is persisted in a Docker volume, and the server is automatically restarted if it crashes.

---

## ☁️ Where to host?
1.  **VPS (DigitalOcean, Hetzner, AWS EC2)**: Best for standalone Go binary or Docker.
2.  **PaaS (Fly.io, Railway, Render)**: Best for Docker.
3.  **Local Home Server**: Great for Ollama-based setups.
