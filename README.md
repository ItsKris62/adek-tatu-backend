# ADEK TATU Official Website — Backend Service

Production-ready, high-security backend service for the **Alliance for Democracy and Equality in Kenya (ADEK TATU)** official website.

Built with **Node.js, TypeScript, Fastify v5, PostgreSQL, Drizzle ORM, Zod, Argon2id, and Envelope Cryptography**.

---

## 1. System Architecture & Tech Stack

- **Runtime:** Node.js (v20+ LTS)
- **Language:** TypeScript (Strict Mode)
- **HTTP Framework:** Fastify v5 (Low-overhead, high-performance)
- **Database:** PostgreSQL (with connection pooling)
- **ORM & Migrations:** Drizzle ORM + Drizzle Kit
- **Validation:** Zod Schemas
- **Password Security:** Argon2id (`argon2` with 64MB memory cost, 3 iterations)
- **Session Authentication:** Database-backed opaque 32-byte tokens, stored as SHA-256 hashes with HttpOnly/Secure/SameSite cookies
- **Multi-Factor Authentication (MFA):** RFC 6238 TOTP with AES-256-GCM encrypted secrets (`otpauth`)
- **Sensitive Identifier Protection:** Envelope encryption (AES-256-GCM) with separate HMAC-SHA-256 duplicate detection
- **Security Headers & Protection:** Helmet, Strict CORS, Cookie Signing, Centralized Rate Limiting
- **Logging:** Pino structured logging with strict redaction of sensitive credentials, National IDs, passwords, and tokens
- **Testing & QA:** Vitest + Fastify Inject testing

---

## 2. Environment Setup

Copy `.env.example` to `.env`:

```bash
cp .env.example .env
```

### Generating Cryptographic Keys

Generate secure 32-byte random hex keys using Node.js:

```bash
node -e "console.log(crypto.randomBytes(32).toString('hex'))"
```

Configure these independent keys in `.env`:
1. `SESSION_SECRET`: Cookie signing & session security
2. `DATA_ENCRYPTION_KEY`: AES-256-GCM key for encrypting sensitive identifiers
3. `DATA_HMAC_KEY`: Independent HMAC secret for duplicate detection
4. `TOTP_ENCRYPTION_KEY`: AES-256-GCM key for encrypting stored TOTP secrets

---

## 3. Database & Migrations

### Generate Migrations (from Drizzle Schemas)
```bash
npm run db:generate
```

### Apply Migrations to PostgreSQL
```bash
npm run db:migrate
```

---

## 4. Administrative User Bootstrap

Create the initial `SUPER_ADMIN` user with interactive/env-driven bootstrap and MFA setup:

```bash
npm run admin:create
```

*Note: The TOTP setup URI and secret are displayed once in the terminal during bootstrap and are never logged or exposed via API.*

---

## 5. Development & Production Commands

| Command | Description |
| :--- | :--- |
| `npm run dev` | Run development server with live reload (`tsx watch`) |
| `npm run build` | Transpile TypeScript to production JavaScript in `dist/` |
| `npm run start` | Run production server (`node dist/server.js`) |
| `npm run typecheck` | Run TypeScript strict type verification |
| `npm run test` | Run full automated Vitest test suite |
| `npm run db:generate` | Generate SQL migrations from Drizzle schemas |
| `npm run db:migrate` | Apply migrations to the target PostgreSQL database |
| `npm run admin:create` | Bootstrap initial Super Admin account |
| `npm run smoke` | Run public API smoke test against live or local server |
| `npm run smoke:admin` | Run authenticated admin workflow smoke test |

---

## 6. API Endpoint Matrix

| Method | Endpoint | Auth | Role | Description |
| :--- | :--- | :--- | :--- | :--- |
| `GET` | `/api/v1/health` | Public | None | System & PostgreSQL connection health |
| `GET` | `/api/v1/health/live` | Public | None | Service liveness probe |
| `GET` | `/api/v1/health/ready` | Public | None | Service readiness probe |
| `POST` | `/api/v1/membership/applications` | Public (Rate Limited) | None | Submit membership registration (Demo) |
| `GET` | `/api/v1/membership/applications/:reference/status` | Public (Rate Limited) | None | Minimal safe status lookup by reference |
| `POST` | `/api/v1/admin/auth/login` | Public (Rate Limited) | None | Step 1 admin login (email + password) |
| `POST` | `/api/v1/admin/auth/mfa/verify` | Public (Rate Limited) | None | Step 2 MFA verification (TOTP code) |
| `GET` | `/api/v1/admin/auth/me` | Cookie / Bearer | Any Admin | Get authenticated admin profile |
| `POST` | `/api/v1/admin/auth/logout` | Cookie / Bearer | Any Admin | Revoke active admin session |
| `GET` | `/api/v1/admin/dashboard/stats` | Cookie / Bearer | `SUPER_ADMIN`, `RECRUITMENT_OFFICER` | Operational stats (SQL aggregation) |
| `GET` | `/api/v1/admin/applications` | Cookie / Bearer | `SUPER_ADMIN`, `RECRUITMENT_OFFICER` | Paginated applications list with filters |
| `GET` | `/api/v1/admin/applications/:id` | Cookie / Bearer | `SUPER_ADMIN`, `RECRUITMENT_OFFICER` | Application detail & review history |
| `PATCH` | `/api/v1/admin/applications/:id/status` | Cookie / Bearer | `SUPER_ADMIN`, `RECRUITMENT_OFFICER` | State-machine status transition |
| `POST` | `/api/v1/admin/applications/:id/reviews` | Cookie / Bearer | `SUPER_ADMIN`, `RECRUITMENT_OFFICER` | Add review note |
| `GET` | `/api/v1/admin/applications/:id/history` | Cookie / Bearer | `SUPER_ADMIN`, `RECRUITMENT_OFFICER` | Review trail and status log |
| `GET` | `/api/v1/admin/audit-logs` | Cookie / Bearer | `SUPER_ADMIN` | Append-only immutable audit trail |
| `GET` | `/api/v1/admin/users` | Cookie / Bearer | `SUPER_ADMIN` | List admin users |
| `POST` | `/api/v1/admin/users` | Cookie / Bearer | `SUPER_ADMIN` | Create new admin user |
| `PATCH` | `/api/v1/admin/users/:id/status` | Cookie / Bearer | `SUPER_ADMIN` | Activate or suspend admin user |
| `GET` | `/api/v1/news` | Public | None | List published news |
| `GET` | `/api/v1/news/:slug` | Public | None | Get published news article |
| `GET` | `/api/v1/admin/news` | Cookie / Bearer | `SUPER_ADMIN`, `CONTENT_EDITOR` | List all news articles |
| `POST` | `/api/v1/admin/news` | Cookie / Bearer | `SUPER_ADMIN`, `CONTENT_EDITOR` | Create news article |
| `PATCH` | `/api/v1/admin/news/:id` | Cookie / Bearer | `SUPER_ADMIN`, `CONTENT_EDITOR` | Update news article |
| `DELETE` | `/api/v1/admin/news/:id` | Cookie / Bearer | `SUPER_ADMIN`, `CONTENT_EDITOR` | Archive news article |
| `GET` | `/api/v1/leadership` | Public | None | List published leadership |
| `GET` | `/api/v1/admin/leadership` | Cookie / Bearer | `SUPER_ADMIN`, `CONTENT_EDITOR` | List all leadership records |
| `POST` | `/api/v1/admin/leadership` | Cookie / Bearer | `SUPER_ADMIN`, `CONTENT_EDITOR` | Create leadership record |
| `PATCH` | `/api/v1/admin/leadership/:id` | Cookie / Bearer | `SUPER_ADMIN`, `CONTENT_EDITOR` | Update leadership record |
| `DELETE` | `/api/v1/admin/leadership/:id` | Cookie / Bearer | `SUPER_ADMIN`, `CONTENT_EDITOR` | Archive leadership record |
| `GET` | `/api/v1/documents` | Public | None | List published party documents |
| `GET` | `/api/v1/admin/documents` | Cookie / Bearer | `SUPER_ADMIN`, `CONTENT_EDITOR` | List all documents |
| `POST` | `/api/v1/admin/documents` | Cookie / Bearer | `SUPER_ADMIN`, `CONTENT_EDITOR` | Create document record |
| `PATCH` | `/api/v1/admin/documents/:id` | Cookie / Bearer | `SUPER_ADMIN`, `CONTENT_EDITOR` | Update document record |
| `DELETE` | `/api/v1/admin/documents/:id` | Cookie / Bearer | `SUPER_ADMIN`, `CONTENT_EDITOR` | Archive document record |
| `GET` | `/api/v1/content/:key` | Public | None | Get published site content section |
| `GET` | `/api/v1/admin/content` | Cookie / Bearer | `SUPER_ADMIN`, `CONTENT_EDITOR` | List managed content sections |
| `PATCH` | `/api/v1/admin/content/:key` | Cookie / Bearer | `SUPER_ADMIN`, `CONTENT_EDITOR` | Upsert managed content section |

---

## 7. cPanel / Truehost Deployment Sequence

1. **Setup Node.js Application in cPanel:**
   - Go to **cPanel > Setup Node.js App**.
   - Node.js Version: Select `20.x` or latest LTS.
   - Application Mode: `Production`.
   - Application Root: `adek-tatu-website-backend`.
   - Application Startup File: `dist/server.js`.
2. **Configure Environment Variables:**
   - In the cPanel Node.js Application Manager, add all required variables from `.env.example`:
     - `NODE_ENV=production`
     - `PORT` (or let cPanel assign passenger port)
     - `HOST=0.0.0.0`
     - `DATABASE_URL=postgresql://<cpanel_user>:<cpanel_pass>@127.0.0.1:5432/<cpanel_db>`
     - `DATABASE_SSL=false`
     - `FRONTEND_ORIGIN=https://<your_domain>`
     - `SESSION_SECRET=<generated_key>`
     - `DATA_ENCRYPTION_KEY=<generated_key>`
     - `DATA_HMAC_KEY=<generated_key>`
     - `TOTP_ENCRYPTION_KEY=<generated_key>`
3. **Install Dependencies & Build:**
   ```bash
   npm install --production=false
   npm run build
   ```
4. **Run Database Migrations:**
   ```bash
   npm run db:migrate
   ```
5. **Create First Super Admin:**
   ```bash
   ADMIN_BOOTSTRAP_EMAIL=admin@yourdomain.org ADMIN_BOOTSTRAP_PASSWORD="YourSecurePassword" ADMIN_BOOTSTRAP_MFA=true npm run admin:create
   ```
6. **Start/Restart Node.js Application:**
   - Click **Restart** in the cPanel Node.js App interface.
   - Verify health check: `GET https://<api_domain>/api/v1/health`.
7. **Configure Frontend:**
   - Set `NEXT_PUBLIC_API_BASE_URL=https://<api_domain>` in the frontend environment.
