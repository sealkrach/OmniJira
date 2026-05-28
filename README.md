# OmniJira

Enterprise Jira federation dashboard — aggregate tickets from multiple Jira instances, generate a Domain → Capability → Initiative use case taxonomy with AI, and track quarterly delivery progress across entities.

![Next.js](https://img.shields.io/badge/Next.js-14-black?logo=next.js)
![TypeScript](https://img.shields.io/badge/TypeScript-5-blue?logo=typescript)
![PostgreSQL](https://img.shields.io/badge/PostgreSQL-15-blue?logo=postgresql)
![Docker](https://img.shields.io/badge/Docker-Compose-2496ED?logo=docker)

---

## Features

- **Multi-instance Jira sync** — connect Jira Cloud and Jira Server instances; background sync via BullMQ worker
- **AI use case generation** — analyzes your epics and tickets, produces a coherent Domain → Capability → Initiative taxonomy in the original language (OpenAI)
- **AI ticket mapping** — automatically maps unmapped tickets to the most relevant Initiative
- **Quarterly Action Plan (QAP)** — tracks progress per entity and use case by quarter, with RAG status (Green / Amber / Red)
- **Export** — PDF and CSV export on Overview, QAP, and Use Cases pages
- **Keycloak SSO** — optional OIDC authentication via Keycloak, alongside local email/password accounts
- **Rule-based mapping** — define conditions (label, component, epic, issue type) to map tickets to use cases automatically on sync

---

## Stack

| Layer | Technology |
|---|---|
| Frontend | Next.js 14 App Router, React, Tailwind CSS, TanStack Query |
| Backend | Next.js API Routes, Prisma ORM |
| Database | PostgreSQL 15 |
| Queue | BullMQ + Redis |
| Auth | NextAuth.js (credentials + optional Keycloak) |
| AI | OpenAI API (gpt-4o-mini default) |
| Export | jsPDF + jspdf-autotable |

---

## Quick Start

### Prerequisites

- Docker & Docker Compose
- An OpenAI API key (optional — needed for AI features)

### 1. Clone and configure

```bash
git clone https://github.com/sealkrach/OmniJira.git
cd OmniJira
cp .env.example .env
```

Edit `.env` and set at minimum:

```env
POSTGRES_PASSWORD=your_secure_password
REDIS_PASSWORD=your_redis_password
NEXTAUTH_SECRET=your_nextauth_secret        # openssl rand -base64 32
ENCRYPTION_KEY=your_64_hex_chars            # openssl rand -hex 32
ADMIN_EMAIL=admin@example.com
ADMIN_PASSWORD=YourPassword123!
OPENAI_API_KEY=sk-...                       # optional
```

### 2. Start

```bash
docker-compose up -d
```

The app will be available at **http://localhost:3000**.

On first start, the seed script creates the admin user defined in `.env`.

### 3. Connect a Jira instance

1. Go to **Jira Instances** → **New**
2. Enter your Jira URL, email, and API token
3. Click **Test** to verify the connection
4. Click **Sync** to import tickets

---

## Development

Use the dev compose file to enable hot-reload without rebuilding:

```bash
docker-compose -f docker-compose.yml -f docker-compose.dev.yml up --build
```

Source code is mounted as a volume — Next.js hot-reloads on save.

---

## Keycloak SSO (optional)

Uncomment and fill in `.env`:

```env
KEYCLOAK_ISSUER=https://keycloak.example.com/realms/my-realm
KEYCLOAK_CLIENT_ID=omnijira
KEYCLOAK_CLIENT_SECRET=your-client-secret
NEXT_PUBLIC_KEYCLOAK_ENABLED=true
```

**Keycloak client settings:**
- Client type: `confidential`
- Valid redirect URIs: `http://localhost:3000/*`
- Web Origins: `http://localhost:3000`

**Role mapping:** users with the `admin` or `omnijira_admin` realm role get `ADMIN` access, everyone else gets `VIEWER`. Roles are read from the access token (`realm_access.roles`).

SSO users are automatically upserted in the database on first login. They cannot sign in with email/password.

---

## AI Features

### Generate taxonomy

1. Sync at least one Jira instance
2. Go to **Use Cases** → **AI Generate**
3. Select the instance and entity
4. The AI clusters tickets by epic and generates a Domain → Capability → Initiative hierarchy using the original epic names

### Map new tickets

After syncing new tickets, click **AI Map** to assign unmapped tickets to the closest existing Initiative. Already-mapped tickets are skipped.

### Reset and regenerate

Click **Reset** to delete all use cases, then **AI Generate** again to rebuild from scratch.

---

## Environment Variables

| Variable | Required | Description |
|---|---|---|
| `DATABASE_URL` | ✅ | PostgreSQL connection string |
| `REDIS_URL` | ✅ | Redis connection string |
| `NEXTAUTH_SECRET` | ✅ | NextAuth JWT signing secret |
| `NEXTAUTH_URL` | ✅ | Public URL of the app |
| `ENCRYPTION_KEY` | ✅ | 64 hex chars — encrypts Jira API tokens at rest |
| `ADMIN_EMAIL` | ✅ | Email for the seed admin account |
| `ADMIN_PASSWORD` | ✅ | Password for the seed admin account |
| `OPENAI_API_KEY` | optional | Enables AI generate/map features |
| `KEYCLOAK_ISSUER` | optional | Keycloak realm URL |
| `KEYCLOAK_CLIENT_ID` | optional | Keycloak client ID |
| `KEYCLOAK_CLIENT_SECRET` | optional | Keycloak client secret |
| `NEXT_PUBLIC_KEYCLOAK_ENABLED` | optional | Set to `true` to show the Keycloak button on the login page |

---

## Architecture

```
┌─────────────────────────────────────────────────────┐
│                    Browser                          │
│   Next.js App Router (React, TanStack Query)        │
└─────────────────┬───────────────────────────────────┘
                  │ HTTP
┌─────────────────▼───────────────────────────────────┐
│              Next.js API Routes                     │
│   /api/jira-instances  /api/use-cases               │
│   /api/tickets         /api/qap                     │
│   /api/llm             /api/mappings                │
└──────┬──────────────────────────┬───────────────────┘
       │ Prisma ORM               │ BullMQ jobs
┌──────▼──────────┐     ┌─────────▼─────────┐
│   PostgreSQL    │     │   Redis + Worker  │
│   (main store)  │     │   (sync queue)    │
└─────────────────┘     └───────────────────┘
                                  │
                         ┌────────▼────────┐
                         │   Jira APIs     │
                         │ Cloud & Server  │
                         └─────────────────┘
```

---

## License

MIT
