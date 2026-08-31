# NOVA Voice AI Platform — Production Deployment Guide

This guide provides step-by-step instructions for deploying NOVA to production using Docker, a Linux VPS, or container cloud platforms (Railway, Fly.io, AWS ECS, DigitalOcean).

---

## 1. Prerequisites

- **Docker & Docker Compose** (Docker v24+ recommended)
- **Domain Name** pointing to your server IP (e.g. `nova.yourdomain.com`)
- **SSL Certificate** (handled automatically via Let's Encrypt / Caddy / Nginx or Cloudflare)
- **At least one AI provider API key** (Google Gemini recommended for free tier)

---

## 2. Quick Deploy with Docker Compose

### Step 1: Clone the repository

```bash
git clone https://github.com/Gagan563/voiceai-platform.git /opt/nova
cd /opt/nova
```

### Step 2: Configure Environment Variables

Copy the production environment template:

```bash
cp .env.production.example .env
```

Edit `.env` and fill in:

```ini
# Generate a secure 64-character secret
JWT_SECRET=$(openssl rand -base64 48)

# Your public domain
CORS_ORIGIN=https://nova.yourdomain.com

# PostgreSQL credentials
POSTGRES_DB=nova_db
POSTGRES_USER=nova_user
POSTGRES_PASSWORD=your_super_strong_password_here

# AI Provider Key (At least one)
GEMINI_API_KEY=AIzaSy...
```

### Step 3: Launch with Production Compose

```bash
docker compose -f docker-compose.prod.yml up -d --build
```

### Step 4: Verify Deployment

```bash
# Check container status
docker compose -f docker-compose.prod.yml ps

# Check API health
curl -f http://localhost:3001/health

# Check metrics
curl -f http://localhost:3001/metrics
```

---

## 3. Reverse Proxy & HTTPS Configuration

### Option A: Caddy (Recommended — Automatic HTTPS)

Create `/etc/caddy/Caddyfile`:

```caddyfile
nova.yourdomain.com {
    reverse_proxy localhost:3001 {
        header_up Host {host}
        header_up X-Real-IP {remote}
        header_up X-Forwarded-For {remote}
        header_up X-Forwarded-Proto {scheme}
    }
}
```

Reload Caddy:
```bash
sudo systemctl reload caddy
```

### Option B: Nginx + Certbot

```nginx
server {
    server_name nova.yourdomain.com;

    location / {
        proxy_pass http://127.0.0.1:3001;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_read_timeout 86400s;
        proxy_send_timeout 86400s;
    }
}
```

Obtain SSL certificate:
```bash
sudo certbot --nginx -d nova.yourdomain.com
```

---

## 4. Operational Monitoring & Health

| Endpoint | Method | Auth | Description |
| :--- | :--- | :--- | :--- |
| `/health` | `GET` | Public | Service uptime, active AI engine, DB status |
| `/metrics` | `GET` | Public | Total requests, status buckets, memory usage |
| `/status` | `GET` | User | Detailed connector and key configuration status |

---

## 5. Backup & Maintenance

### Database Backup
```bash
docker compose -f docker-compose.prod.yml exec postgres pg_dump -U nova_user nova_db > backup_$(date +%Y%m%d).sql
```

### Database Restore
```bash
cat backup_YYYYMMDD.sql | docker compose -f docker-compose.prod.yml exec -T postgres psql -U nova_user nova_db
```

### Updating to Latest Version
```bash
git pull origin main
docker compose -f docker-compose.prod.yml up -d --build
```
