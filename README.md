# Buku UMKM - UMKM Accounting & Tax Helper

A simple web application designed to help Indonesian MSMEs (UMKM) manage bookkeeping and tax calculations. Record income, manage expenses, track debts/receivables, generate financial reports, and estimate tax obligations — all in one place.

Built specifically for UMKM (Usaha Mikro, Kecil, dan Menengah), this app focuses on simplicity so business owners can manage their finances without complex accounting software.

## Features

- **Transaction Management** — Record income and expenses with photo attachments, categories, and reusable templates
- **Chart of Accounts** — SAK EMKM-compliant hierarchical account structure
- **Financial Reports** — Income statement (Laba Rugi), balance sheet (Neraca), and transaction notes (Catatan)
- **Tax Calculation** — PPh 0.5% final tax calculation, tax history tracking, and billing code management
- **Debt & Receivables** — Track hutang/piutang with payment schedules
- **PDF & Excel Export** — Export reports and SPT tax forms
- **Offline Support** — PWA with service worker for offline access
- **Photo Storage** — Attach receipt photos to transactions (stored in Cloudflare R2)
- **Backup & Restore** — Full data backup and restore capability

## Tech Stack

- **Framework**: [SvelteKit](https://svelte.dev/) (Svelte 5)
- **Styling**: [Tailwind CSS v4](https://tailwindcss.com/) + [shadcn-svelte](https://next.shadcn-svelte.com/)
- **Database**: [Cloudflare D1](https://developers.cloudflare.com/d1/) (SQLite) via [Drizzle ORM](https://orm.drizzle.team/)
- **Auth**: [Better Auth](https://www.better-auth.com/) (email/password)
- **Storage**: [Cloudflare R2](https://developers.cloudflare.com/r2/) (photos & backups)
- **Cache**: [Cloudflare KV](https://developers.cloudflare.com/kv/)
- **Hosting**: [Cloudflare Workers](https://developers.cloudflare.com/workers/)
- **Charts**: [LayerChart](https://layerchart.com/)
- **Testing**: [Vitest](https://vitest.dev/) + [Playwright](https://playwright.dev/)

## Prerequisites

- [Node.js](https://nodejs.org/) >= 18
- [Cloudflare account](https://dash.cloudflare.com/sign-up) (free tier works)
- [Wrangler CLI](https://developers.cloudflare.com/workers/wrangler/) (included as dev dependency)

## Getting Started

### 1. Clone the repository

```bash
git clone https://github.com/<your-username>/buku-umkm.git
cd buku-umkm
npm install
```

### 2. Set up Cloudflare resources

Create a D1 database, R2 bucket, and KV namespace via the Cloudflare dashboard or Wrangler CLI:

```bash
# Create D1 database
npx wrangler d1 create buku-umkm-db

# Create R2 bucket
npx wrangler r2 bucket create buku-umkm-receipts

# Create KV namespace
npx wrangler kv namespace create KV
```

### 3. Configure wrangler.jsonc

Update the placeholder values in `wrangler.jsonc` with your actual resource IDs:

```jsonc
{
	"d1_databases": [
		{
			"database_id": "<YOUR_D1_DATABASE_ID>" // from step 2
		}
	],
	"kv_namespaces": [
		{
			"id": "<YOUR_KV_NAMESPACE_ID>" // from step 2
		}
	]
}
```

### 4. Set up environment variables

```bash
cp .env.example .env
```

Edit `.env` and fill in the values:

```env
ORIGIN="http://localhost:5173"

# Generate a 32+ character secret for auth
BETTER_AUTH_SECRET="your-secret-here"

# Generate a 32+ character key for NPWP encryption
NPWP_ENCRYPTION_KEY="your-encryption-key-here"
```

### 5. Run database migrations

```bash
# Apply migrations locally
npm run db:migrate:local
```

### 6. Start the development server

```bash
npm run dev
```

Open [http://localhost:5173](http://localhost:5173).

## Available Scripts

| Command                     | Description                                     |
| --------------------------- | ----------------------------------------------- |
| `npm run dev`               | Start dev server                                |
| `npm run build`             | Build for production                            |
| `npm run preview`           | Build and preview with Wrangler                 |
| `npm run check`             | Run Svelte type checking                        |
| `npm run lint`              | Run Prettier and ESLint                         |
| `npm run format`            | Format code with Prettier                       |
| `npm run test`              | Run tests                                       |
| `npm run db:generate`       | Generate Drizzle migrations from schema changes |
| `npm run db:migrate:local`  | Apply migrations to local D1                    |
| `npm run db:migrate:remote` | Apply migrations to remote D1                   |
| `npm run deploy`            | Build and deploy to Cloudflare Workers          |

## Project Structure

```
src/
├── routes/
│   ├── (app)/              # Protected app routes
│   │   ├── beranda/        # Dashboard
│   │   ├── transaksi/      # Transactions (CRUD, photos)
│   │   ├── akun/           # Chart of Accounts
│   │   ├── kategori/       # Categories
│   │   ├── laporan/        # Reports (income stmt, balance sheet)
│   │   ├── hutang-piutang/ # Debts & receivables
│   │   ├── pajak/          # Tax management
│   │   └── pengaturan/     # Settings & templates
│   ├── api/                # API endpoints
│   ├── masuk/              # Login
│   ├── daftar/             # Registration
│   └── onboarding/         # Onboarding flow
├── lib/
│   ├── server/
│   │   ├── db/             # Schema, queries, seed data
│   │   ├── auth.ts         # Better Auth config
│   │   └── crypto.ts       # Encryption utilities
│   ├── components/         # Svelte components (shadcn-svelte)
│   ├── tax/                # Tax calculation engine
│   └── utils/              # Export utilities (PDF, Excel, SPT)
└── service-worker.ts       # PWA offline support
```

## Deployment

Deploy to Cloudflare Workers:

```bash
# Apply migrations to remote database first
npm run db:migrate:remote

# Build and deploy
npm run deploy
```

## Contributing

Contributions are welcome! Please open an issue or submit a pull request.

## License

This project is open source. See the [LICENSE](LICENSE) file for details.
