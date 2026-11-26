# Buku UMKM - UMKM Accounting & Tax Helper

A simple web application that helps Indonesian MSMEs (UMKM) keep their books and estimate their PPh Final tax. Record income and expenses, track debts, receivables and loans, read financial reports, and see what tax is due and when — all in one place.

Built for UMKM (Usaha Mikro, Kecil, dan Menengah): business owners can manage their finances without complex accounting software. The interface is in Indonesian.

## Features

- **Transactions** — Income and expenses with receipt photos, categories and reusable templates; transfers between accounts; mistaken transfers and debt payments can be reversed
- **Accrual bookkeeping (SAK EMKM)** — Credit sales and purchases count on the day they are recorded; payments only move cash; loans received or given never count as income or expense
- **Financial reports** — Income statement (Laba Rugi), balance sheet (Neraca) and notes (Catatan), on the Asia/Jakarta calendar
- **PPh Final 0.5% estimates** — Eligibility under PP 55/2022 as amended by PP 20/2026, the Rp500 juta exemption for individuals, billing-code details, payments actually made with underpayment warnings, and reminders for every open month with deadlines moved past weekends, national holidays and cuti bersama
- **Debts & receivables** — Hutang/piutang usaha and loans, with payment history; a loan payment splits principal (cash only) from interest, booked as an expense on a loan received or income on a loan given (kept out of PPh Final turnover)
- **Exports** — PDF and Excel reports, CSV transactions, and an SPT Tahunan support draft
- **Accounts** — Email and password sign-in, email verification, password reset by email, and permanent account deletion
- **Backup & restore** — A versioned .zip backup of the whole book with its receipt photos, validated row by row and restored atomically (older .json backups still restore)
- **Installable PWA** — Cached public shell, offline page and locally kept transaction drafts (cleared on sign-out)

## Tech Stack

- **Framework**: [SvelteKit](https://svelte.dev/) 2 (Svelte 5)
- **Styling**: [Tailwind CSS v4](https://tailwindcss.com/) + [shadcn-svelte](https://next.shadcn-svelte.com/)
- **Database**: [Cloudflare D1](https://developers.cloudflare.com/d1/) (SQLite) via [Drizzle ORM](https://orm.drizzle.team/)
- **Auth**: [Better Auth](https://www.better-auth.com/) (email/password)
- **Storage**: [Cloudflare R2](https://developers.cloudflare.com/r2/) (receipt photos)
- **Email**: [Cloudflare Email Service](https://developers.cloudflare.com/email-service/) (password reset and verification)
- **Rate limiting**: [Workers Rate Limiting](https://developers.cloudflare.com/workers/runtime-apis/bindings/rate-limit/) bindings
- **Hosting**: [Cloudflare Workers](https://developers.cloudflare.com/workers/)
- **Charts**: hand-written SVG components
- **Testing**: [Vitest](https://vitest.dev/) (unit, local-D1 integration and browser component tests)

## Prerequisites

- [Node.js](https://nodejs.org/) 22.12 or later (24 LTS recommended; see `.nvmrc`)
- [pnpm](https://pnpm.io/) (the version is pinned in `package.json` under `packageManager`)
- A [Cloudflare account](https://dash.cloudflare.com/sign-up). Local development needs no account. For production, use the **Workers Paid** plan: on Free, Email Service only delivers to verified addresses, and restoring a backup needs more CPU time than the Free plan's limit.

## Getting Started

```bash
git clone https://github.com/<your-username>/buku-umkm.git
cd buku-umkm
pnpm install

cp .env.example .env        # then fill in BETTER_AUTH_SECRET and NPWP_ENCRYPTION_KEY
pnpm db:migrate:local       # create the local D1 database
pnpm dev
```

Open [http://localhost:5173](http://localhost:5173). D1, R2, email and rate limiting run locally through Wrangler's simulation; sent emails are written under `.wrangler/tmp/email/` instead of being delivered.

To run the production build on the Workers runtime instead, copy `.dev.vars.example` to `.dev.vars` and run `pnpm preview` (served on [http://localhost:8787](http://localhost:8787)).

## Available Scripts

| Command                   | Description                                                    |
| ------------------------- | -------------------------------------------------------------- |
| `pnpm dev`                | Start the dev server                                           |
| `pnpm build`              | Build for production                                           |
| `pnpm preview`            | Build and run the Worker locally with Wrangler                 |
| `pnpm check`              | Run Svelte type checking                                       |
| `pnpm lint`               | Run Prettier and ESLint                                        |
| `pnpm format`             | Format code with Prettier                                      |
| `pnpm test`               | Run all tests (unit, local D1 and browser)                     |
| `pnpm db:generate`        | Generate a Drizzle migration from schema changes               |
| `pnpm db:migrate:local`   | Apply migrations to the local D1 database                      |
| `pnpm db:migrate:remote`  | Apply migrations to the production D1 database                 |
| `pnpm db:migrate:staging` | Apply migrations to the staging D1 database                    |
| `pnpm run deploy`         | Check the config, build and deploy to production               |
| `pnpm run deploy:staging` | Check the config, build and deploy to staging                  |
| `pnpm cf-typegen`         | Regenerate `src/worker-configuration.d.ts` from wrangler.jsonc |
| `pnpm auth:schema`        | Regenerate the Better Auth tables in `auth.schema.ts`          |

Use `pnpm run deploy`, not `pnpm deploy`: the latter is a built-in pnpm command.

## Configuration

| Name                  | Kind               | Where                    | Purpose                                                                   |
| --------------------- | ------------------ | ------------------------ | ------------------------------------------------------------------------- |
| `ORIGIN`              | var                | `wrangler.jsonc`, `.env` | Public URL of the app; auth cookies and email links are built from it     |
| `EMAIL_FROM`          | var                | `wrangler.jsonc`, `.env` | Sender address for account emails, on a domain onboarded to Email Sending |
| `BETTER_AUTH_SECRET`  | secret             | Worker secret, `.env`    | Signs sessions and tokens; 32+ random characters                          |
| `NPWP_ENCRYPTION_KEY` | secret             | Worker secret, `.env`    | Encrypts NPWP at rest; 32+ characters; never change it once data exists   |
| `DB`                  | D1 binding         | `wrangler.jsonc`         | The database (`database_id` must be filled in)                            |
| `R2`                  | R2 binding         | `wrangler.jsonc`         | Receipt photos                                                            |
| `EMAIL`               | send_email binding | `wrangler.jsonc`         | Cloudflare Email Service                                                  |
| `*_RATE_LIMITER` (5)  | ratelimit bindings | `wrangler.jsonc`         | Sign-in, sign-up, email, API and backup/restore limits                    |

Local values go in `.env` (`pnpm dev`) or `.dev.vars` (`pnpm preview`). Production values are the top level of `wrangler.jsonc`; staging values are under `env.staging`.

## Deployment

`wrangler.jsonc` ships with `<PLACEHOLDER>` values because this repository is a template. `pnpm run deploy` and `pnpm run deploy:staging` refuse to deploy while any remain (`scripts/check-deploy-config.mjs`).

### One-time setup (production)

1. **Create the database and bucket**, then put the printed `database_id` into `wrangler.jsonc`:

   ```bash
   pnpm wrangler d1 create buku-umkm-db
   pnpm wrangler r2 bucket create buku-umkm-receipts
   ```

2. **Rate limiter namespaces.** Each `ratelimits[].namespace_id` (1001–1005 for production, 2001–2005 for staging) must be unique among rate limiters in your Cloudflare account; change them if they clash. Limits are kept per Cloudflare location, so treat them as a brake, not an exact quota.

3. **Email.** The sending domain must use Cloudflare DNS. Onboard it in the dashboard (Compute › Email Service › Email Sending) or with:

   ```bash
   pnpm wrangler email sending enable <your-domain>
   pnpm wrangler email sending dns get <your-domain>   # check the records
   ```

   Onboarding adds MX, SPF and DKIM records on the `cf-bounce` subdomain and a DMARC record on `_dmarc.<your-domain>`; review the DMARC policy if other services also send mail for the domain. New accounts start with a small daily sending quota that grows with good sending behaviour. You can restrict the binding with `"allowed_sender_addresses": ["noreply@<your-domain>"]`.

4. **Vars.** In `wrangler.jsonc`, set `vars.ORIGIN` to the public `https://` URL and `vars.EMAIL_FROM` to the sender, e.g. `noreply@<your-domain>`.

5. **Secrets** (generate each with e.g. `openssl rand -base64 32`):

   ```bash
   pnpm wrangler secret put BETTER_AUTH_SECRET
   pnpm wrangler secret put NPWP_ENCRYPTION_KEY
   ```

### Every release

```bash
pnpm db:migrate:remote   # apply new migrations first
pnpm run deploy          # checks the config, builds and deploys
```

### Staging

Repeat the setup with the staging names (`buku-umkm-db-staging`, `buku-umkm-receipts-staging`) and fill in `env.staging` in `wrangler.jsonc`; set secrets with `--env staging`. Then:

```bash
pnpm db:migrate:staging
pnpm run deploy:staging
```

D1 keeps point-in-time history ([Time Travel](https://developers.cloudflare.com/d1/reference/time-travel/)), so the database can be restored to an earlier minute if a release goes wrong.

## Testing

```bash
pnpm test                                             # everything
pnpm exec vitest run --project unit <path>            # one unit or D1 test file
pnpm exec vitest run --project browser <path>         # one component test
```

- Tests named `*.d1.test.ts` run against an in-memory local D1 on the real Workers runtime (`src/lib/server/testing/d1.ts`), so they enforce D1's own rules: no `BEGIN`/`SAVEPOINT` transactions, at most 100 bound parameters per statement, and atomic batches.
- Browser component tests (`*.svelte.spec.ts`) drive the installed Google Chrome through Playwright.
- CI (`.github/workflows/ci.yml`) runs lint, type check, all tests and the build on every push and pull request.

## Bookkeeping and Tax Notes

- **Writes are atomic.** D1 rejects `BEGIN`, so every multi-row write is a single `db.batch()`. Conditions that must hold at write time (sufficient balance, no overpayment, the 3-photo limit) are batch guards: an insert into `finance_guard` whose trigger aborts the whole batch (`src/lib/server/db/batch.ts`, migration `0006`).
- **Tax figures are estimates** from the recorded books and the tax profile. Where the profile cannot decide eligibility, the app says so instead of estimating. Rules cite their articles in `src/lib/tax/eligibility.ts`.
- **Yearly maintenance:** payment deadlines use the official SKB holiday lists in `src/lib/tax/deadline.ts` (2026 and 2027 today). Add each new year's list when the SKB is published; until then that year only skips weekends.

## Security Notes

- Every query is scoped to the signed-in user, including relation loads; restore remaps all ids and never accepts storage keys from a file. Images in a .zip backup are checked by their bytes (JPEG or PNG, at most 500 KB, 3 per transaction) and stored under fresh keys in the restoring user's prefix.
- Content Security Policy with per-request nonces (`kit.csp` in `svelte.config.js`); static assets get their headers from `_headers`.
- State-changing requests need a matching `Origin` header (or `Sec-Fetch-Site: same-origin`).
- NPWP is encrypted at rest with AES-256-GCM. Receipt photos are served `private, no-store` and only to their owner.
- Error logs leave out SQL parameters and personal data.

## Known Limitations

- **SvelteKit 3:** `pnpm audit` still lists SvelteKit 2.x advisories. The high and moderate ones affect only remote functions, which this app does not use; the low ones are fixed only in SvelteKit 3. The migration is planned as a separate change.
- **A .zip backup over 95 MB cannot bring its photos back in one go.** Cloudflare refuses request bodies over 100 MB on Free and Pro zones, so for a larger file the settings page offers to restore the data without photos (it sends only the backup.json inside). A chunked restore that uploads the photos in parts is a possible follow-up.
- **Old .json backups contain no photo images.** Their photo rows come back only when restoring into the account that made the backup while the images are still stored.
- **Restore leaves the replaced book's images in R2** (a .zip restore stores fresh copies), so unreferenced photos accumulate until a cleanup job exists.
- **Loan interest** is booked when it is paid or received, not accrued over the loan's term. All interest on loans given is kept out of PPh Final turnover; a business whose usaha is lending would need that revisited.
- **Very large books** (over 10 MB or 30,000 rows per backup) cannot be restored in one go; the app refuses them before writing anything.

## Project Structure

```
src/
├── routes/
│   ├── (app)/                 # Signed-in pages: beranda, transaksi, akun, kategori,
│   │                          # laporan, hutang-piutang, pajak, pengaturan, ...
│   ├── api/                   # JSON endpoints (transactions, debts, tax, backup, account, ...)
│   ├── masuk/ daftar/         # Sign in, sign up
│   ├── lupa-kata-sandi/       # Request a password reset
│   ├── atur-ulang-kata-sandi/ # Set a new password from the emailed link
│   ├── verifikasi-email/      # Email verification landing page
│   └── onboarding/            # First-run setup
├── lib/
│   ├── server/
│   │   ├── db/                # Schema, queries, seed data, batch helpers
│   │   ├── finance/           # Transaction, transfer and debt commands (atomic D1 batches)
│   │   ├── reports/           # Balance sheet
│   │   ├── backup/            # Backup export, restore parsing and planning
│   │   ├── account/           # Account deletion, verification
│   │   ├── email/             # Cloudflare Email Service messages
│   │   ├── security/          # Rate limiting, CSRF, password policy
│   │   └── testing/           # Local D1 test harness
│   ├── tax/                   # PPh Final engine, eligibility, deadlines, reminders
│   ├── components/            # Svelte components (shadcn-svelte)
│   └── utils/                 # Formatting and export utilities (PDF, Excel, CSV, SPT)
├── hooks.server.ts            # Auth, rate limiting, CSRF and security headers
└── service-worker.ts          # PWA shell cache and offline fallback
drizzle/                       # SQL migrations
scripts/check-deploy-config.mjs
```

## Contributing

Contributions are welcome! Please open an issue or submit a pull request.

## License

Released under the [MIT License](LICENSE).
