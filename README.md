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
| `npm run admin:reset-password` | Emergency CLI password reset with session revocation |
| `npm run admin:reset-mfa` | Emergency CLI MFA/TOTP reset with new setup material |
| `npm run admin:revoke-sessions` | Emergency CLI active sessions revocation for an admin |
| `npm run admin:disable` | Deactivate an admin account and revoke all sessions |
| `npm run admin:enable` | Reactivate a disabled admin account |
| `npm run smoke` | Run public API smoke test against live or local server |
| `npm run smoke:admin` | Run authenticated admin workflow smoke test |

---

## 6. Emergency Admin Recovery

Administrative account recovery is strictly restricted to command-line operator tools directly on the server to prevent unauthorized email compromise or account takeover vectors.

### 6.1 Lost Admin Password
When an administrator loses their password:
```bash
npm run admin:reset-password
```
- Prompts for the administrator's email and new password (minimum 10 characters).
- Hashes the password using Argon2id.
- Transactionally updates the account and immediately revokes all existing active sessions.
- Logs an immutable security audit event: `ADMIN_PASSWORD_RESET_BY_OPERATOR`.
- Never displays or logs the password or hash.

### 6.2 Lost Authenticator / MFA Device
When an administrator loses their authenticator phone or 2FA device:
```bash
npm run admin:reset-mfa
```
- Requires explicit operator confirmation.
- Generates a new random Base32 TOTP secret and encrypts it with `TOTP_ENCRYPTION_KEY`.
- Revokes all existing active sessions for that administrator.
- Displays the new TOTP setup URI once in the terminal for re-enrollment.
- Logs an immutable security audit event: `ADMIN_MFA_RESET_BY_OPERATOR`.

> [!WARNING]
> **DO NOT** regenerate `TOTP_ENCRYPTION_KEY` in `.env` as an MFA recovery method! Changing `TOTP_ENCRYPTION_KEY` renders all existing MFA secrets for all administrators undecryptable. Always use `npm run admin:reset-mfa` for individual administrator recovery.

### 6.3 Suspected Session Theft or Compromise
If an admin session is suspected of being intercepted:
```bash
npm run admin:revoke-sessions
```
- Instantly marks all active sessions for that admin as revoked.
- Any subsequent request with that session cookie or token is immediately rejected with HTTP 401.

### 6.4 Account Suspension & Reactivation
```bash
npm run admin:disable
npm run admin:enable
```
- Disabling deactivates the account and instantly invalidates all active sessions without deleting records.

---

## 7. Cryptographic Key Disaster & Lifecycle Notes

| Key | Purpose | Disaster / Loss Consequence |
| :--- | :--- | :--- |
| `DATA_ENCRYPTION_KEY` | AES-256-GCM encryption of sensitive identifiers (National IDs) | **CRITICAL DATA LOSS:** If lost or modified, all previously encrypted National IDs become permanently unrecoverable. Never rotate casually without a cryptographic re-encryption migration. |
| `DATA_HMAC_KEY` | HMAC-SHA-256 duplicate detection | **DUPLICATE DETECTION DISRUPTION:** If modified, previously computed HMAC digests will not match new submissions, allowing duplicate applications. |
| `TOTP_ENCRYPTION_KEY` | AES-256-GCM encryption of stored admin TOTP secrets | **LOCKOUT RISK:** If modified, all stored administrator MFA credentials fail decryption. All admins will require manual MFA re-enrollment via `npm run admin:reset-mfa`. |
| `SESSION_SECRET` | Cookie signing & session-bound CSRF HMAC | **SESSION EXPIRATION:** If rotated, all currently active sessions and CSRF tokens become invalid immediately. Admins must log in again. No persistent data is lost. |

---

## 8. API Endpoint Matrix

| Method | Endpoint | Auth | Role | Description |
| :--- | :--- | :--- | :--- | :--- |
| `GET` | `/api/v1/health` | Public | None | System & PostgreSQL connection health |
| `GET` | `/api/v1/health/live` | Public | None | Service liveness probe |
| `GET` | `/api/v1/health/ready` | Public | None | Service readiness probe |
| `POST` | `/api/v1/membership/applications` | Public (Rate Limited) | None | Submit membership registration (Honeypot + Turnstile protected) |
| `GET` | `/api/v1/membership/applications/:reference/status` | Public (Rate Limited) | None | Minimal safe status lookup by reference |
| `POST` | `/api/v1/admin/auth/login` | Public (Rate Limited) | None | Step 1 admin login (email + password) |
| `POST` | `/api/v1/admin/auth/mfa/verify` | Public (Rate Limited) | None | Step 2 MFA verification (TOTP code) |
| `GET` | `/api/v1/admin/auth/me` | Cookie / Bearer | Any Admin | Get authenticated admin profile |
| `GET` | `/api/v1/admin/auth/csrf` | Cookie / Bearer | Any Admin | Get active session CSRF token |
| `POST` | `/api/v1/admin/auth/logout` | Cookie / Bearer (CSRF) | Any Admin | Revoke active admin session |
| `GET` | `/api/v1/admin/reports/membership/summary` | Cookie / Bearer | `SUPER_ADMIN`, `RECRUITMENT_OFFICER` | Aggregated recruitment & breakdown statistics |
| `GET` | `/api/v1/admin/reports/membership/export` | Cookie / Bearer | `SUPER_ADMIN`, `RECRUITMENT_OFFICER` | Sanitized CSV export (Max 10,000 rows, injection protected) |
| `GET` | `/api/v1/admin/members` | Cookie / Bearer | `SUPER_ADMIN`, `RECRUITMENT_OFFICER` | Demonstration approved-member register list |
| `GET` | `/api/v1/admin/members/:id` | Cookie / Bearer | `SUPER_ADMIN`, `RECRUITMENT_OFFICER` | Approved member details (Masked ID only) |
| `GET` | `/api/v1/admin/dashboard/stats` | Cookie / Bearer | `SUPER_ADMIN`, `RECRUITMENT_OFFICER` | Operational stats (SQL aggregation) |
| `GET` | `/api/v1/admin/applications` | Cookie / Bearer | `SUPER_ADMIN`, `RECRUITMENT_OFFICER` | Paginated applications list with filters |
| `GET` | `/api/v1/admin/applications/:id` | Cookie / Bearer | `SUPER_ADMIN`, `RECRUITMENT_OFFICER` | Application detail & review history |
| `PATCH` | `/api/v1/admin/applications/:id/status` | Cookie / Bearer (CSRF) | `SUPER_ADMIN`, `RECRUITMENT_OFFICER` | State-machine status transition |
| `POST` | `/api/v1/admin/applications/:id/reviews` | Cookie / Bearer (CSRF) | `SUPER_ADMIN`, `RECRUITMENT_OFFICER` | Add review note |
| `GET` | `/api/v1/admin/applications/:id/history` | Cookie / Bearer | `SUPER_ADMIN`, `RECRUITMENT_OFFICER` | Review trail and status log |
| `GET` | `/api/v1/admin/audit-logs` | Cookie / Bearer | `SUPER_ADMIN` | Append-only immutable audit trail |
| `GET` | `/api/v1/admin/users` | Cookie / Bearer | `SUPER_ADMIN` | List admin users |
| `POST` | `/api/v1/admin/users` | Cookie / Bearer (CSRF) | `SUPER_ADMIN` | Create new admin user |
| `PATCH` | `/api/v1/admin/users/:id/status` | Cookie / Bearer (CSRF) | `SUPER_ADMIN` | Activate or suspend admin user |
| `GET` | `/api/v1/news` | Public | None | List published news |
| `GET` | `/api/v1/news/:slug` | Public | None | Get published news article |
| `GET` | `/api/v1/admin/news` | Cookie / Bearer | `SUPER_ADMIN`, `CONTENT_EDITOR` | List all news articles |
| `POST` | `/api/v1/admin/news` | Cookie / Bearer (CSRF) | `SUPER_ADMIN`, `CONTENT_EDITOR` | Create news article |
| `PATCH` | `/api/v1/admin/news/:id` | Cookie / Bearer (CSRF) | `SUPER_ADMIN`, `CONTENT_EDITOR` | Update news article |
| `DELETE` | `/api/v1/admin/news/:id` | Cookie / Bearer (CSRF) | `SUPER_ADMIN`, `CONTENT_EDITOR` | Archive news article |
| `GET` | `/api/v1/leadership` | Public | None | List published leadership |
| `GET` | `/api/v1/admin/leadership` | Cookie / Bearer | `SUPER_ADMIN`, `CONTENT_EDITOR` | List all leadership records |
| `POST` | `/api/v1/admin/leadership` | Cookie / Bearer (CSRF) | `SUPER_ADMIN`, `CONTENT_EDITOR` | Create leadership record |
| `PATCH` | `/api/v1/admin/leadership/:id` | Cookie / Bearer (CSRF) | `SUPER_ADMIN`, `CONTENT_EDITOR` | Update leadership record |
| `DELETE` | `/api/v1/admin/leadership/:id` | Cookie / Bearer (CSRF) | `SUPER_ADMIN`, `CONTENT_EDITOR` | Archive leadership record |
| `GET` | `/api/v1/documents` | Public | None | List published party documents |
| `GET` | `/api/v1/admin/documents` | Cookie / Bearer | `SUPER_ADMIN`, `CONTENT_EDITOR` | List all documents |
| `POST` | `/api/v1/admin/documents` | Cookie / Bearer (CSRF) | `SUPER_ADMIN`, `CONTENT_EDITOR` | Create document record |
| `PATCH` | `/api/v1/admin/documents/:id` | Cookie / Bearer (CSRF) | `SUPER_ADMIN`, `CONTENT_EDITOR` | Update document record |
| `DELETE` | `/api/v1/admin/documents/:id` | Cookie / Bearer (CSRF) | `SUPER_ADMIN`, `CONTENT_EDITOR` | Archive document record |
| `GET` | `/api/v1/content/:key` | Public | None | Get published site content section |
| `GET` | `/api/v1/admin/content` | Cookie / Bearer | `SUPER_ADMIN`, `CONTENT_EDITOR` | List managed content sections |
| `PATCH` | `/api/v1/admin/content/:key` | Cookie / Bearer (CSRF) | `SUPER_ADMIN`, `CONTENT_EDITOR` | Upsert managed content section |

---

## 9. Deployment Status

> [!NOTE]
> **Deployment Status:** `DEPLOYMENT CANDIDATE`
> Live production PostgreSQL connection and cPanel runtime deployment are intentionally postponed per project instructions. All local modules, security mechanisms, cryptographic routines, and CLI recovery tools have been validated.
