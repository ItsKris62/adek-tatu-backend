# Deploy the backend on Truehost cPanel

This folder is a Fastify/TypeScript API, not a Next.js application. Do not add
the Next.js custom server from the hosting guide. The existing build command
bundles the API into `dist/server.js`; `app.cjs` loads that ES module through
a CommonJS entry point for cPanel/Passenger.

## Upload and configure

1. Run `npm ci` and `npm run build` in this backend folder locally.
2. Upload the backend files into a dedicated application directory outside
   `public_html`. Exclude `.git`, `node_modules`, and your local `.env`.
   Include `app.cjs`, `dist`, `package.json`, and `package-lock.json`.
   Include `src`, `scripts`, `migrations`, `tsconfig.json`, and
   `drizzle.config.ts` if building or running database maintenance on the host.
3. In **Setup Node.js App**, select Production and an available supported
   Node.js release compatible with Fastify 5 (minimum Node.js 20).
   Set the application root to the directory containing `package.json`,
   and the startup file to `app.cjs`. Use your API domain/subdomain as the URL.
4. Configure the environment variables below, then activate the exact Node.js
   environment command displayed by cPanel in its Terminal.
5. In the application root, run `npm ci --omit=dev` if uploading the local
   build. This installs dependencies for the hosting server, including argon2.
   Do not upload Windows `node_modules`.
6. Alternatively, to build on the host, run `npm ci --include=dev` followed by
   `npm run build`. Build tools are development dependencies, so a production-only
   install cannot perform the build.
7. Restart the application using cPanel. Open `/api/v1/health/live`, followed
   by `/api/v1/health/ready` on the API domain to check the process and database.

The extracted layout must be:

```text
<application root>/
  app.cjs
  package.json
  package-lock.json
  dist/
    server.js
  node_modules/       # installed on Truehost
```

Avoid an extra nested backend folder beneath the configured application root.
The existing `npm start` command remains valid for running directly with Node.

## Environment and database

Use `.env.example` as the full reference. Configure at least:

- `NODE_ENV=production`
- `DATABASE_URL`: a reachable PostgreSQL database URL (this API does not use MySQL).
- `SESSION_SECRET`
- `DATA_ENCRYPTION_KEY`
- `DATA_HMAC_KEY`
- `TOTP_ENCRYPTION_KEY`
- `FRONTEND_ORIGIN`: the exact HTTPS frontend origin; comma-separate multiple origins.

Preserve existing cryptographic keys when moving an existing database. See
README.md for key requirements. Configure `DATABASE_SSL` according to the database
provider. Configure `TRUST_PROXY` to match the hosting proxy topology. Leave the
hosting-provided `PORT` intact; the server already reads it.

For a new database, apply the existing migrations deliberately using
`npm run db:migrate` with development dependencies installed. This changes the
configured database. Do not generate new migrations merely to deploy the app.

## Existing Git deployment file

The existing `.cpanel.yml` is separate from this manual upload procedure. Before
using it, verify its hard-coded deployment path and Node.js path with Truehost.
Its `cp -R *` command also copies `node_modules` if present, despite the comment,
and can attempt to copy files onto themselves if the checkout and deployment
directory are the same. Its `npm install` can omit build tools in production.
Use the manual procedure above until these account-specific paths are verified.

## Diagnosing a failed start

- Missing `dist/server.js`: run the build and upload `dist`.
- `ERR_REQUIRE_ESM`: verify the startup file is `app.cjs`.
- Missing packages or native argon2 errors: install dependencies on the host.
- Environment validation failure: configure the variables identified by the log.
- Database connection failure: verify PostgreSQL access and SSL configuration.
- A 404 at `/`: test the health endpoints; the API has no frontend homepage.

If it still fails, capture the relevant `stderr.log` lines, selected Node.js
version, application root, and startup filename. Omit credentials and secrets.

References:
- https://truehost.com/support/knowledge-base/how-to-deploy-nextjs-on-cpanel/
- https://fastify.dev/docs/v5.4.x/Guides/Migration-Guide-V5/
