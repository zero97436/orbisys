# Orbisys

[🇫🇷 Français](README.md) · **🇬🇧 English**

<!-- Replace OWNER/REPO with the real GitHub path once the repo is pushed. -->
[![CI](https://github.com/zero97436/orbisys/actions/workflows/ci.yml/badge.svg)](https://github.com/zero97436/orbisys/actions/workflows/ci.yml)
![Python](https://img.shields.io/badge/python-3.12-blue)
![React](https://img.shields.io/badge/react-18-61dafb)
![Docker](https://img.shields.io/badge/docker-compose-2496ed)

**A complete, self-hosted infrastructure monitoring platform** — the modern alternative
to traditional monitoring tools: hosts, checks, intelligent alerting, built-in ticketing,
mapping, APM, containers, SLA reports and an AI assistant, all deployed with a single
Docker Compose command.

> 🖥️ Linux/Windows servers · 🌐 Network (SNMP/SSH) · 📦 Docker/Kubernetes · 🖴 Proxmox/VMware ·
> 🔧 Hardware (IPMI/Redfish) · 🗄️ Databases · 📈 Applications (APM) · 🎫 Ticketing ·
> 🗺️ Maps · 📄 PDF reports · 🤖 AI

---

## Table of contents

1. [Editions](#-editions-open-core--community--professional--business--enterprise)
2. [Features](#-features)
3. [Architecture](#-architecture)
4. [Installation](#-installation)
   - [Linux (production, recommended)](#linux-production-recommended)
   - [Windows](#windows-evaluation--workstation)
   - [macOS](#macos)
   - [Updating](#updating)
5. [Getting started](#-getting-started)
6. [The metrics agent (Windows/Linux)](#-the-metrics-agent-windowslinux)
7. [The 26 check types](#-the-26-check-types)
8. [Intelligent alerting](#-intelligent-alerting)
9. [Tickets (built-in ITSM)](#-tickets-built-in-itsm)
10. [The views](#-the-views)
11. [Migrating from another tool](#-migrating-from-another-monitoring-tool)
12. [Licensing: activate the paid edition](#-licensing-activate-the-paid-edition)
13. [AI assistant (optional)](#-ai-assistant-optional)
14. [Backup & restore](#-backup--restore)
15. [Security](#-security)
16. [Troubleshooting (FAQ)](#-troubleshooting-faq)
17. [Development & tests](#-development--tests)

---

## 💰 Editions (open-core): Community · Professional · Business · Enterprise

A **generous Community edition** to drive adoption, with paid plans aligned to
organizational maturity. Each plan **includes everything above it**.

### 🆓 Community (free, no key required)
✅ **Up to 25 hosts** · all 26 check types · full dashboard · mapping (topology +
geographic map) · history · availability graphs · **email + webhook** alerts ·
maintenance windows, dependencies, flapping detection, escalations · Windows/Linux
agent · network discovery · templates · migration (.cfg / CSV) · internal tickets ·
REST API · **local AI assistant** (incident analysis + chat — the differentiating
feature stays free) · TV mode · public status page.

### 💼 Professional — *adds:*
✅ Advanced notification channels (**Slack, Teams, Discord, Telegram, SMS, script**)
· **SLA / MTTR** reports · **PDF export** · **per-user customizable dashboards** ·
extended retention · brand customization · email support.

### 🏢 Business — *adds:*
✅ **ITSM** connectors (Jira, ServiceNow, outbound webhook) · **remediation
automation** (agent actions + AI plans) · **distributed monitoring** (checks run by
probes/agents) · **multi-tenant MSP** (isolated customers) · extended API.

### 🏛️ Enterprise — *adds:*
✅ **High availability** (multi-instance scheduler, leader election) · **SSO / SAML /
OIDC** (Keycloak, Azure AD, Google…) · **audit / compliance** log · **24/7** support,
training, custom development, onboarding.

**How it works:**
- Without a key: Community edition, forever. Beyond a plan limit the action is refused
  with a clear message stating the required plan — **nothing stops**, existing
  monitoring keeps running.
- The license key carries the plan (validated offline, Ed25519 signature); features
  unlock instantly, with no reinstall.
- To activate: see [Licensing](#-licensing-activate-the-paid-edition).

---

## ✨ Features

### Monitoring
- **26 check types** (details [here](#-the-26-check-types)): ping, ports, HTTP(S),
  SSL certificates, DNS, NTP, SNMP (any OID + interface traffic), SSH + remote
  commands, email (SMTP/IMAP/POP3), FTP, LDAP, 4 database engines, Docker, Kubernetes,
  Proxmox, VMware, IPMI/Redfish, application APM, Windows agent…
- **Metrics agent** (Windows/Linux): CPU, RAM, multi-disk, network, processes,
  temperatures, Windows services — with offloaded check execution (probe mode) and
  operator-approved remote remediation.
- **Network discovery**: scan an IP range, detect open ports, one-click import with
  suggested checks.
- **Check templates**: reusable check sets (built-in + created by capturing an
  existing host), one-click application to a host, without duplicates.

### Alerting
- State-change detection → **alert** → **notifications** across 8 channels:
  email, Slack, Telegram, Teams, Discord, SMS, webhook, custom script.
- **Escalations** (channels reserved for the 2nd level after X minutes without
  acknowledgment), per-channel **time windows**, incident **acknowledgment**.
- Smart noise suppression: **maintenance windows**, **parent/child dependencies**
  (a down router = no alert for the devices behind it), **flapping detection**
  (unstable state = alerts suspended, event logged).

### Operations
- **Built-in tickets** (full ITSM module): **automatic creation on incident** (no
  duplicates, auto-resolved when back to OK), tasks (checklist), timestamped
  follow-ups, assignment with email notification, priorities, push to **Jira /
  ServiceNow / webhook**.
- **Reports**: per-host SLA, MTTR, 24 h/7 d/30 d availability, **PDF export**.
- **BAM** (business monitoring): aggregated business services (worst-state or % OK rule).
- **Views**: per-user customizable dashboard, business operations map (drag & drop),
  network topology, **geographic map** (click-to-place), full-screen **TV mode**,
  **public status page** (no login), global search **Ctrl+K**, event log, APM,
  Docker containers.
- **AI assistant** (optional): incident analysis, remediation suggestions, health
  summary, natural-language chat — 100% local, no data leaves your infrastructure.

### Administration
- Users and **roles** (admin / operator / viewer + custom per-section roles), HTTPS,
  secrets encrypted at rest, brute-force protection, automatic data retention/purge,
  backups, migration (.cfg / CSV config), 240+ automated tests.

---

## 🧱 Architecture

| Layer | Technology |
|---|---|
| Backend API | Python 3.12, FastAPI, SQLAlchemy 2, Alembic (auto migrations) |
| Check execution | Celery + Redis (worker) + scheduler |
| Database | PostgreSQL 16 |
| Frontend | React 18, TypeScript, Vite, TailwindCSS |
| Reverse proxy | Nginx (HTTP 8080 / HTTPS 8443) |
| AI (optional) | Ollama (local LLM) |

7 containers orchestrated by a single `docker-compose.yml`:
`db`, `redis`, `backend`, `worker`, `scheduler`, `frontend`, `nginx`.

---

## 🚀 Installation

### Prerequisites (all OSes)

- **Docker** + **Docker Compose v2** (included in Docker Desktop / the `docker-compose-plugin` package)
- **2 GB RAM** minimum recommended, ~2 GB disk
- Free ports: **8080** (HTTP) and **8443** (HTTPS)

> The software installs **exclusively via Docker** — that is what guarantees an
> identical install on every system. No Python, Node or PostgreSQL installation is
> needed on the host machine.

### Linux (production, recommended)

Tested on Debian/Ubuntu; identical on RHEL/Alma/Rocky (replace `apt` with `dnf`).

```bash
# 1. Install Docker (if missing)
curl -fsSL https://get.docker.com | sh
sudo usermod -aG docker $USER && newgrp docker

# 2. Get the project
git clone https://github.com/zero97436/orbisys.git orbisys
cd orbisys

# 3. Configure the environment
cp .env.example .env
nano .env
```

**Variables you MUST change before production:**

| Variable | Purpose |
|---|---|
| `SECRET_KEY` | JWT signing key + secret encryption. Generate: `openssl rand -hex 32`. ⚠️ Never change it afterwards (it decrypts stored secrets). |
| `POSTGRES_PASSWORD` | database password |
| `ADMIN_EMAIL` / `ADMIN_PASSWORD` | initial administrator account |
| `CORS_ORIGINS` | the server's real URL(s), e.g. `https://monitoring.mydomain.com:8443` |
| `INGEST_API_KEY` | key required from metrics agents (generate a random value) |
| `SMTP_*` | mail server for email notifications |

```bash
# 4. Generate the self-signed TLS certificate (once)
openssl req -x509 -nodes -newkey rsa:2048 -days 825   -keyout deploy/nginx/certs/server.key -out deploy/nginx/certs/server.crt   -subj "/CN=orbisys"

# 5. Start (build + automatic migrations)
docker compose up -d --build

# 6. Verify
docker compose ps                      # all services "Up"
curl -k https://localhost:8443/health  # {"status":"ok"}
```

→ Interface: `http://SERVER_IP:8080` or `https://SERVER_IP:8443`
→ Login: the value of `ADMIN_EMAIL` / `ADMIN_PASSWORD` (default `admin@local` / `admin1234` — **change it!**)

**Recommended production finishing touches:**

```bash
# Automatic start on boot: already handled (Docker restart policy) if the Docker
# daemon is enabled:
sudo systemctl enable docker

# Daily backup at 2 a.m. (PostgreSQL dump into ./backups):
crontab -e
0 2 * * * cd /path/to/Orbisys && ./scripts/backup.sh >> /var/log/orbisys-backup.log 2>&1

# Real TLS certificate (default: self-signed) — drop your files in:
#   deploy/nginx/certs/server.crt  and  server.key
# then: docker compose restart nginx
```

### Windows (evaluation / workstation)

1. Install **Docker Desktop** (with WSL2): <https://www.docker.com/products/docker-desktop/>
2. Open PowerShell:

```powershell
git clone https://github.com/zero97436/orbisys.git orbisys
cd orbisys
Copy-Item .env.example .env
notepad .env          # same variables as Linux
docker compose up -d --build
```

3. Interface at `http://localhost:8080`.
4. Backups: `.\scripts\backup.ps1` (schedulable via Task Scheduler — see the comment
   at the top of the script).

### macOS

Identical to Windows: **Docker Desktop for Mac**, then the same commands in the
Terminal (`cp` instead of `Copy-Item`). Works on Intel and Apple Silicon.

### NAS (Synology / QNAP / Unraid)

Works if the NAS offers Docker + Compose and has **2 GB of free RAM**. Import the
`docker-compose.yml` into the NAS Docker UI, or use SSH with the Linux commands above.

### Updating

```bash
cd orbisys
git pull
docker compose up -d --build     # database migrations applied automatically
docker compose restart nginx     # refreshes the reverse proxy
```

Data (database, backups) lives in Docker volumes: an update never touches the data.
**Taking a backup first** remains best practice.

### Uninstalling

```bash
docker compose down          # stop (data preserved)
docker compose down -v       # ⚠️ stop + DELETE the data
```

---

## 🎯 Getting started

1. **Log in** with the admin account, then **change the password** (Settings → Users)
   and create your team's accounts (roles: admin / operator / viewer, plus custom
   per-section roles).
2. **Add your first host**: **Hosts** page → "New host" (name + IP), or run a
   **Discovery** (scan a `192.168.1.0/24` range) and import the detected devices with
   their suggested checks.
3. **Apply a template**: **Templates** page → pick "Linux server", "Web server
   (HTTPS)", "Network device"… → select the host → Apply. Checks start immediately.
4. **Configure notifications**: Settings → notification channels (email, Telegram,
   Slack…) → "Test" button.
5. **Place devices on the map**: **Map** page → "My location" then "📍 Place a host"
   → click on the map.
6. **Create business services** (**Business** page) to feed the Operations view and
   the public status page (`/status`, accessible without login).

---

## 📡 The metrics agent (Windows/Linux)

For fine-grained system metrics (CPU, RAM, **all disks**, network, processes,
temperatures) and remote actions, install the agent on the machine:

```bash
# Prerequisites: Python 3.10+ and psutil
pip install psutil requests

python scripts/agent_example.py \
  --server https://monitoring.mydomain.com:8443 \
  --hostname MY-SERVER \
  --key YOUR_INGEST_API_KEY \
  --interval 30
```

- **Windows**: schedule at startup via Task Scheduler (`Register-ScheduledTask`,
  example at the top of the script).
- **Linux**: systemd unit:

```ini
# /etc/systemd/system/orbisys-agent.service
[Unit]
Description=Orbisys agent
After=network-online.target
[Service]
ExecStart=/usr/bin/python3 /opt/orbisys/agent_example.py --server https://... --hostname %H --key XXX
Restart=always
[Install]
WantedBy=multi-user.target
```

The agent also enables **probe mode**: run checks *from* this machine (e.g. test a
device the central server cannot reach), and **remediation** (restart a service
remotely after approval in the interface).

> 💡 Per-host supervision mode: each host can be set to **agentless** (the server
> probes it directly), **agent** (push over HTTPS — the host page shows a ready-to-copy
> install command) or **SSH** (the server connects over SSH; checks reuse the host's
> SSH credentials).

---

## 🔌 The 26 check types

Each check has `warning`/`critical` thresholds, an interval, a timeout, and a JSON
config. Passwords/secrets in configs are **encrypted at rest**.

| Type | Monitors | Main config |
|---|---|---|
| `ping` | device liveness (ICMP) | — |
| `tcp_port` | open port | `{"port": 443}` |
| `http` | web page / API (status code, latency, content) | `{"scheme": "https", "path": "/health", "expect": "OK"}` |
| `ssl_expiry` | certificate expiration | thresholds = days remaining |
| `dns` | DNS resolution | `{"record": "A", "expect": "1.2.3.4"}` |
| `ntp` | time server clock drift | thresholds = ms of drift |
| `snmp` | **any OID** (CPU, uptime, toner, sensor…) | `{"oid": "1.3.6.1...", "community": "public"}` |
| `snmp_traffic` | throughput + errors on a network interface | `{"if_index": 1, "community": "public"}` |
| `ssh` | SSH port + authentication | `{"user": "...", "password": "..."}` |
| `ssh_command` | remote command (= custom metric) | `{"command": "...", "expect": "..."}` |
| `smtp` / `imap` / `pop3` | mail servers | `{"port": ..., "tls": true}` |
| `ftp` | FTP server | — |
| `ldap` | LDAP/AD directory | `{"base_dn": "dc=..."}` |
| `database` | **PostgreSQL, MySQL/MariaDB, Oracle, SQL Server**: connection + query + latency | `{"engine": "oracle", "user": "...", "password": "...", "dbname": "XEPDB1", "query": "SELECT 1 FROM dual"}` |
| `metric` | agent metrics (cpu/mem/disk/net/load/temperature) | `{"metric": "cpu_percent"}` |
| `windows_service` | Windows service state (via agent) | `{"service": "Spooler"}` |
| `disk_usage` / `cpu_load` | local disk/CPU of the monitoring server | — |
| `apm` | applications: error rate, latency, throughput | `{"app": "my-erp", "metric": "error_rate"}` |
| `docker` | containers: whole fleet or a specific container (state, health, CPU) | `{}` or `{"container": "nginx"}` |
| `kubernetes` | nodes / pods of a namespace / deployment | `{"api_url": "https://...:6443", "token": "...", "mode": "pods", "namespace": "prod"}` |
| `proxmox` | cluster / VM+CT of a node / a VM (CPU, RAM) | `{"api_url": "https://pve:8006", "token_id": "sup@pve!mon", "token_secret": "...", "mode": "cluster"}` |
| `vmware` | vCenter/ESXi: ESXi hosts / VMs / a VM | `{"api_url": "https://vcenter", "user": "...", "password": "...", "mode": "hosts"}` |
| `ipmi` | **hardware** health via Redfish (iDRAC, iLO, XCC…): fans, PSUs, RAID aggregated | `{"api_url": "https://idrac", "user": "...", "password": "..."}` |

**Examples of covered equipment**: servers, switches, routers, Wi-Fi access points,
IP cameras (ping + RTSP port 554 + web interface), printers (SNMP toners), NAS, UPS
units (SNMP), hypervisors, containers, websites, business applications.

---

## 🔔 Intelligent alerting

**Cycle**: state change → alert → notifications → escalation if unacknowledged →
automatic resolution when back to OK.

| Mechanism | What it does | Setting |
|---|---|---|
| **8 channels** | email, Slack, Telegram, Teams, Discord, SMS, webhook, script | Settings → Notifications |
| **Time windows** | a channel can be active only at night, on weekends… | channel's `active_hours` |
| **Escalation** | "escalation-only" channels notified after X min without acknowledgment | `ESCALATION_AFTER_MINUTES` (default 15) |
| **Maintenance** | scheduled window = no alerts for the host | Incidents page → Maintenance |
| **Dependencies** | down parent host = no alert for its children (unreachable ≠ down) | host's "Parent host" field |
| **Flapping** | ≥ 7 state changes over the last 20 results = alerts suspended + event logged | `FLAPPING_*` in `.env` |

Everything is logged on the **Events** page (opened/resolved alerts, suppressions and
their reason, notifications sent).

---

## 🎫 Tickets (built-in ITSM)

A real ticketing module (service desk):

- **Automatic creation** on incident (CRITICAL/WARNING) — enabled by
  `ITSM_AUTO_CREATE=true`:
  - Title: `HostName: Incident on CheckName`
  - Written body ("Hello, … Best regards, Monitoring") with the technical detail
  - **De-duplication**: a single open ticket per failing check, even during flapping
  - **Auto-resolution**: the ticket moves to "Resolved" when the check returns to OK
- **Full editing**: title, description, priority, status — every change is logged in
  the follow-ups ("title: X → Y; priority: low → high")
- **Tasks**: checklist with progress (2/5), ticked off as the intervention proceeds
- **Follow-ups**: timestamped comment thread with author
- **Assignment**: to a user, with automatic **email notification** (except
  self-assignment), "Mine" filter
- **External push**: `ITSM_PROVIDER=jira|servicenow|webhook` → each ticket is also
  created in the external tool (clickable link kept). A push failure never blocks the
  local ticket.

```ini
# .env — Jira example
ITSM_PROVIDER=jira
ITSM_URL=https://mycompany.atlassian.net
ITSM_USER=bot@mycompany.com
ITSM_TOKEN=xxxx
ITSM_PROJECT=OPS
ITSM_AUTO_CREATE=true
```

---

## 🖥️ The views

| View | URL | Description |
|---|---|---|
| **Dashboard** | `/dashboard` | global state, KPIs, incidents, trend — **per-user customizable** ("Customize" button: reorder/hide sections) |
| **Monitoring** | `/monitoring` | real-time event stream + health matrix |
| **Hosts / Checks** | `/hosts`, `/checks` | fleet management, network discovery, import/migration |
| **Templates** | `/templates` | check templates (built-in + host capture) |
| **Incidents** | `/incidents` | incident center: acknowledgment, AI analysis, remediation, 1-click ticket, maintenance |
| **Tickets** | `/tickets` | full ITSM module |
| **APM** | `/apm` | applications: throughput/errors/latency (the backend self-instruments) |
| **Containers** | `/containers` | Docker: state + CPU/RAM per container |
| **Topology** | `/topology` | logical network map (React Flow) with dependencies |
| **Map** | `/geo` | worldwide geographic map — place hosts **by clicking** |
| **Operations** | `/operations` | business activity map — **drag & drop** tiles |
| **Business** | `/bam` | business service (BAM) definition |
| **Reports** | `/reports` | SLA, MTTR, availability + **PDF export** |
| **TV mode** | `/tv` | full screen for a NOC wall display ("TV" button at the top) |
| **Public status** | `/status` | **unauthenticated** status page for your users (disable with `STATUS_PAGE_ENABLED=false`) |
| **Documentation** | `/docs` | built-in, per-section user guide (an "Help" link on each page jumps to the right section) |
| **Search** | `Ctrl+K` | global search: hosts, checks, tickets, events, pages |

---

## 🔄 Migrating from another monitoring tool

**Hosts → "Import" button**. Two formats, with **mandatory preview** (nothing is
created before confirmation) and **idempotent imports** (re-importing never creates
duplicates — de-duplication by IP).

### 1. Universal CSV (from any tool, via CSV / Excel export)

Export the hosts from the old tool to CSV with these columns (any order, `,` or `;`
separator, only `name` and `ip` are required):

```csv
name;ip;environment;site;latitude;longitude;template;parent
Paris Router;192.168.1.1;production;Paris Office;48.85;2.35;Network device (basic);
Paris Server;192.168.1.10;production;Paris Office;;;Linux server;Paris Router
```

| Column | Effect |
|---|---|
| `template` | automatically applies this **check template** to the created host |
| `parent` | creates the parent/child **dependency** (name of a host in the file or already existing) |
| `site`, `latitude`, `longitude` | the host appears directly on the **geographic map** |

### 2. Configuration files (`.cfg`)

Paste (or upload) the concatenated content of `hosts.cfg` + `services.cfg`:

- `define host` → host created (alias, address) — the **`parents` directive becomes an
  Orbisys dependency** ✨
- `define service` → check mapped automatically:
  `check_http`→`http`, `check_tcp!8443`→`tcp_port 8443`, `check_ssh`, `check_ping`,
  `check_smtp/ftp/dns/imap/pop/ldap/snmp`…
- A `ping` check is added to every host
- **Unmappable** commands (custom `check_custom_xyz` plugins) are listed as clear
  warnings — to be recreated via `ssh_command` or a native type

### Advice based on your current tool

| You have… | Recommended path |
|---|---|
| **`.cfg` config files** | direct import (`.cfg` format) |
| **A CSV / Excel export** of the inventory | universal CSV import |
| **An export API / CLI** | convert the export to CSV (name, IP, site…) then CSV import |
| **No export possible** | use the built-in **Network Discovery**: scan the IP range, one-click import |

> 💡 The old tool's history is not migrated (metrics start fresh) — it's the
> configuration that matters, and it transfers in a few minutes.

---

## 🔑 Licensing: activate the paid edition

1. Purchase an **Enterprise** license from the vendor (you receive a **signed key**
   carrying the subscribed features: SSO, HA, multi-tenant, support…).
2. On the server:

```ini
# .env
LICENSE_KEY=eyJwbGFuIjoicHJvIiwibWF4X2hvc3RzIjoxMDAwLC4uLg.a1b2c3...
```

```bash
docker compose up -d backend worker scheduler && docker compose restart nginx
```

3. Verify: **Hosts** page → "x hosts · enterprise edition".

- The key is **cryptographically signed** (Ed25519): any modified, expired or invalid
  key is ignored and the software falls back to the Community edition (without ever
  stopping — monitoring keeps running).
- The key can carry an expiration date (annual license) and a customer name.
- No internet connection is required for validation (fully offline).

---

## 🤖 AI assistant (optional)

The AI is **fully local**: no monitoring data leaves your infrastructure. It requires
[Ollama](https://ollama.com) installed on the host:

```bash
ollama pull llama3.1:8b
```

```ini
# .env — working defaults if Ollama runs on the host machine
OLLAMA_BASE_URL=http://host.docker.internal:11434
OLLAMA_MODEL=llama3.1:8b
```

What the AI does:
- **Analyze an incident** (button on each alert): probable cause + suggested actions
- **Assisted remediation**: proposes actions (restart a service…) executed by the
  agent **after human approval** — never automatically
- **Health summary** of the fleet on the dashboard
- **Chat** (`/assistant`): "which hosts had problems last night?", with the ability to
  generate action plans (creating hosts/checks) to approve

Without Ollama: the rest of the software works normally, the AI buttons simply show a
clear error.

---

## 💾 Backup & restore

```bash
# Backup (compressed PostgreSQL dump into ./backups/)
./scripts/backup.sh            # Linux/macOS
.\scripts\backup.ps1           # Windows

# Restore
./scripts/restore.sh backups/supervision-2026-07-04.dump
.\scripts\restore.ps1 backups\supervision-2026-07-04.dump
```

Also back up, in addition to the dump: the **`.env`** file (it contains `SECRET_KEY`,
without which secrets encrypted in the database cannot be decrypted) and
`deploy/nginx/certs/`.

Automatic data retention (tunable in `.env`): check results 30 d, raw metrics 15 d
(hourly aggregates 1 year), resolved alerts 90 d, events 90 d.

---

## 🔁 High availability (HA — Enterprise)

The backend and workers are **stateless**: scale them freely behind nginx. The only
singleton component is the **scheduler** — Orbisys includes **leader election** (a
Redis lock with a renewed TTL): run several schedulers, only one schedules, the others
stand by and take over **automatically** if the leader goes down (no duplicated check
execution, hands-free failover).

```bash
# Multiple instances of each tier (Postgres/Redis HA managed separately):
docker compose up -d --scale backend=3 --scale worker=3 --scale scheduler=2
```

- Immediate failover on graceful shutdown (SIGTERM releases the lock), otherwise ~90 s
  (lease expiry) on a hard crash.
- Cluster state: `GET /api/ha/status` (admin, Enterprise) — current leader, heartbeat
  freshness.
- Without Redis (single instance), the scheduler stays local leader: nothing breaks.
- For full HA, plan for highly available Postgres and Redis (replication / managed
  service) — outside the scope of the Orbisys image.

---

## 🔐 Security

- **HTTPS** ready to use (self-signed certificate provided, replaceable with your own)
- **JWT** with 2 h expiry, **brute-force protection** on login (10 attempts / 5 min /
  IP, counted behind the proxy via `X-Forwarded-For`)
- **RBAC**: admin (everything), operator (operations), viewer (read-only), plus
  **custom roles** with per-section write rights
- **Secrets encrypted at rest** (Fernet): SNMP/SSH/DB/API passwords in configs
- The **public status page** exposes only the name/state of business services — never
  an IP, host or technical detail
- The `script` notification channel runs commands: **admins only**
- ⚠️ To do at install time: change `ADMIN_PASSWORD`, `SECRET_KEY`,
  `POSTGRES_PASSWORD`, set `INGEST_API_KEY`, restrict `CORS_ORIGINS`

---

## 🩺 Troubleshooting (FAQ)

**502 Bad Gateway after an update**
Nginx keeps stale container addresses:
```bash
docker compose restart nginx
```

**"Invalid credentials" even though the password is correct**
Check that the backend container is healthy: `docker compose logs backend --tail 50`.

**Emails are not sent**
`SMTP_HOST` is empty or incorrect in `.env`. Test the channel from
Settings → Notifications → "Test". With Gmail: an app password is required.

**The agent doesn't appear / metrics missing**
1. Does the host exist with the **same name** as `--hostname`?
2. Is the agent's `INGEST_API_KEY` the same as the server's?
3. Agent logs: error 401 (key), 404 (host not found)?

**The Containers page says "Docker Engine unreachable"**
The socket is not mounted (host without Docker or a modified compose) — check the
`/var/run/docker.sock` volume in `docker-compose.yml`.

**A check oscillates and no longer generates alerts**
That's **flapping** detection (by design). See the Events page
(`alert_suppressed_flapping`). Adjust `FLAPPING_THRESHOLD` if too sensitive.

**Reset a forgotten admin password**
```bash
docker compose exec backend python -c "
from app.db.session import SessionLocal
from app.models.user import User
from app.core.security import hash_password
db = SessionLocal()
u = db.query(User).filter_by(email='admin@local').first()
u.hashed_password = hash_password('NewPassword!')
db.commit(); print('OK')"
```

---

## 🧪 Development & tests

```bash
# Backend tests (240+ tests)
docker compose exec backend pytest -q

# Frontend tests
cd frontend && npx vitest run

# Rebuild after code changes
docker compose up -d --build backend worker scheduler frontend
docker compose restart nginx
```

Adding a check type = one class in `backend/app/checks/plugins/` + one line in
`registry.py` + the enum value. Use any existing plugin as a template.

---

## Code license

Distributed under the terms of the [LICENSE](LICENSE) file. The Community edition is
free with no host limit; Enterprise features are unlocked with a license key from the
vendor.
