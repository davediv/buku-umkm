# Project TODO List

*Generated from PRD.md on 2026-03-12*

## Executive Summary

Buku UMKM is a free, open-source, offline-first PWA for Indonesian UMKM bookkeeping with integrated PPh Final 0.5% tax compliance. The tech stack is SvelteKit (Svelte 5), Cloudflare Workers/D1/R2/KV, Drizzle ORM, Better Auth, shadcn-svelte, and TailwindCSS v4.

---

## Phase 1: Foundation & Setup

*Correlates to Milestone M1 (Weeks 1-2) and M2 (Weeks 3-4)*

### Infrastructure & Environment

- [x] **INFRA-P1-001**: Install and configure TailwindCSS v4 with Vite
  - **Success Criteria**:
    - `@tailwindcss/vite` added to devDependencies and configured in `vite.config.ts`
    - CSS-first configuration via `src/app.css` with `@import "tailwindcss"` (no `tailwind.config.js`)
    - `app.html` or root layout imports `app.css`
    - Running `npm run dev` renders Tailwind utility classes correctly
  - **Dependencies**: None

- [x] **INFRA-P1-002**: Install and configure shadcn-svelte component library
  - **Success Criteria**:
    - `shadcn-svelte` initialized with `npx shadcn-svelte@next init`
    - `$lib/components/ui` directory created with base components
    - `cn()` utility available at `$lib/utils`
    - CSS variables for theming configured in `app.css`
    - A test component (e.g., Button) renders correctly
  - **Dependencies**: INFRA-P1-001

- [x] **INFRA-P1-003**: Install @lucide/svelte icon package (Svelte 5)
  - **Success Criteria**:
    - `@lucide/svelte` added to devDependencies (NOT `lucide-svelte`)
    - Icons render correctly in a test component
  - **Dependencies**: None

- [x] **INFRA-P1-004**: Configure Cloudflare R2 binding for receipt photo storage
  - **Success Criteria**:
    - R2 bucket binding added to `wrangler.jsonc` with binding name `R2`
    - `worker-configuration.d.ts` regenerated with `npm run cf-typegen`
    - R2 bucket accessible in server-side code via `platform.env.R2`
  - **Dependencies**: None

- [x] **INFRA-P1-005**: Configure Cloudflare KV binding for session/cache
  - **Success Criteria**:
    - KV namespace binding added to `wrangler.jsonc` with binding name `KV`
    - `worker-configuration.d.ts` regenerated with `npm run cf-typegen`
    - KV namespace accessible in server-side code via `platform.env.KV`
  - **Dependencies**: None

- [x] **INFRA-P1-006**: Set up Bahasa Indonesia i18n message file architecture
  - **Success Criteria**:
    - Message files directory created at `src/lib/i18n/`
    - Indonesian locale file `id.ts` with key-value message map
    - Helper function `t(key)` or equivalent for string lookup
    - All hardcoded UI strings use message keys (enforced by convention)
    - Architecture supports adding future locales (e.g., `en.ts`)
  - **Dependencies**: None

- [x] **INFRA-P1-007**: Configure Content Security Policy headers
  - **Success Criteria**:
    - CSP headers set in `hooks.server.ts` or SvelteKit `handle`
    - `script-src`, `style-src`, `img-src` directives configured
    - No CSP violations in browser console during normal app usage
  - **Dependencies**: None

- [x] **INFRA-P1-008**: Configure rate limiting via Cloudflare WAF rules
  - **Success Criteria**:
    - Rate limiting rules defined for API endpoints (auth, data mutations)
    - Auth endpoints limited to 5 requests/minute per IP
    - Data API endpoints limited to 60 requests/minute per user
  - **Dependencies**: None

### Database & Data Models

- [x] **DB-P1-001**: Design and implement complete Drizzle ORM schema for all MVP entities
  - **Success Criteria**:
    - Schema file at `src/lib/server/db/schema.ts` contains tables for: `business_profile`, `account`, `category`, `transaction`, `transaction_photo`, `debt`, `debt_payment`, `tax_record`, `backup`
    - All monetary amounts stored as `integer` (Rupiah, no decimals)
    - All dates stored as ISO 8601 text
    - Foreign key relationships properly defined
    - `user` table extended from Better Auth schema with fields: `npwp`, `npwp_type`, `business_name`, `business_type`
    - Placeholder `task` table removed
    - Category `code` field follows SAK EMKM convention (1xxx-8xxx)
  - **Dependencies**: AUTH-P1-001

- [x] **DB-P1-002**: Generate and apply D1 database migration
  - **Success Criteria**:
    - `npm run db:generate` produces migration SQL in `drizzle/` directory
    - `npm run db:migrate:local` applies migration to local D1 without errors
    - All tables visible in local D1 database
    - Sample row insert and query succeeds for each table
  - **Dependencies**: DB-P1-001

- [x] **DB-P1-003**: Create seed data for SAK EMKM Chart of Accounts templates
  - **Success Criteria**:
    - Seed script or data file with default categories for 4 business types: warung makan, toko kelontong, jasa, manufaktur
    - Categories follow SAK EMKM structure: 1xxx (Assets), 2xxx (Liabilities), 3xxx (Equity), 4xxx (Revenue), 5xxx-8xxx (Expenses)
    - Each template has at least 15-20 categories covering common UMKM transactions
    - System categories marked with `is_system: true`
    - Seed data can be inserted per user during onboarding
  - **Dependencies**: DB-P1-002

- [x] **DB-P1-004**: Create database query helper functions (data access layer)
  - **Success Criteria**:
    - Helper functions in `src/lib/server/db/queries/` for each entity (transactions, accounts, categories, debts, tax records)
    - Functions use Drizzle ORM query builder with proper typing
    - All queries filter by `user_id` for data isolation
    - Aggregate functions for dashboard (total balance, monthly income/expense, cumulative revenue)
  - **Dependencies**: DB-P1-002

### Authentication & Authorization

- [x] **AUTH-P1-001**: Generate Better Auth schema and complete auth setup
  - **Success Criteria**:
    - `npm run auth:schema` generates auth tables in `src/lib/server/db/auth.schema.ts`
    - Auth schema exported from `schema.ts`
    - Migration generated and applied with auth tables
    - `BETTER_AUTH_SECRET` and `ORIGIN` set in `.dev.vars`
  - **Dependencies**: None

- [x] **AUTH-P1-002**: Implement user registration API with email/password
  - **Success Criteria**:
    - POST to Better Auth signup endpoint creates a new user
    - Password hashed with bcrypt/argon2 (minimum 8 characters enforced)
    - Duplicate email returns appropriate error
    - New user record created in D1 database
  - **Dependencies**: AUTH-P1-001, DB-P1-002

- [x] **AUTH-P1-003**: Implement user login API with session management
  - **Success Criteria**:
    - POST to Better Auth login endpoint with valid credentials returns session
    - Invalid credentials return 401 with Bahasa Indonesia error message
    - Session cookie set with secure flags (HttpOnly, Secure, SameSite)
    - `event.locals.user` and `event.locals.session` populated in hooks
  - **Dependencies**: AUTH-P1-001, DB-P1-002

- [x] **AUTH-P1-004**: Implement auth guards for protected routes
  - **Success Criteria**:
    - Unauthenticated requests to protected pages redirect to `/masuk` (login)
    - API routes return 401 for unauthenticated requests
    - Auth guard logic in `hooks.server.ts` or layout server load
    - Public routes (`/`, `/masuk`, `/daftar`) accessible without auth
  - **Dependencies**: AUTH-P1-003

- [x] **AUTH-P1-005**: Implement logout functionality
  - **Success Criteria**:
    - Logout endpoint clears session cookie
    - User redirected to landing page after logout
    - Session invalidated server-side
  - **Dependencies**: AUTH-P1-003

### User Interface Foundation

- [x] **UI-P1-001**: Create mobile-first app shell layout with bottom navigation
  - **Success Criteria**:
    - Root layout at `src/routes/(app)/+layout.svelte` with bottom nav bar
    - Bottom nav has 5 items: Beranda (Dashboard), Transaksi, Hutang/Piutang, Pajak, Lainnya (More)
    - Nav icons from @lucide/svelte with labels in Bahasa Indonesia
    - Active nav item visually highlighted
    - Touch targets >= 48px
    - Layout is mobile-first, responsive up to desktop
    - Content area scrollable independently of nav
  - **Browser Validation** (chrome-devtools MCP):
    - Navigate to app shell and verify bottom nav renders with 5 items
    - Tap each nav item and verify active state changes
    - Resize to mobile viewport (375px) and verify layout is correct
    - Resize to desktop viewport and verify layout adapts
    - Verify touch targets are >= 48px using Elements inspector
  - **Dependencies**: INFRA-P1-001, INFRA-P1-002, INFRA-P1-003

- [x] **UI-P1-002**: Create authentication pages (Masuk / Daftar)
  - **Success Criteria**:
    - Login page at `/masuk` with email and password fields
    - Registration page at `/daftar` with name, email, password fields
    - Client-side validation with Bahasa Indonesia error messages
    - Submit button disabled during request
    - Successful login redirects to `/beranda` (dashboard)
    - Successful registration redirects to onboarding wizard
    - Link between login and registration pages
    - All text in Bahasa Indonesia
  - **Browser Validation** (chrome-devtools MCP):
    - Navigate to `/masuk` and verify form renders with email/password fields
    - Submit empty form and verify validation errors in Bahasa Indonesia
    - Enter invalid credentials and verify error message displays
    - Enter valid credentials and verify redirect to `/beranda`
    - Navigate to `/daftar` and verify registration form
    - Register new user and verify redirect to onboarding
    - Check Network tab for correct API calls
  - **Dependencies**: AUTH-P1-002, AUTH-P1-003, INFRA-P1-006

- [x] **UI-P1-003**: Create landing page at root route `/`
  - **Success Criteria**:
    - Public landing page explaining Buku UMKM value proposition
    - CTA buttons linking to `/daftar` (register) and `/masuk` (login)
    - All text in Bahasa Indonesia
    - Mobile-responsive design
    - Professional, trust-building visual design
  - **Browser Validation** (chrome-devtools MCP):
    - Navigate to `/` and verify landing page renders
    - Click CTA buttons and verify navigation to auth pages
    - Resize to mobile and verify responsive layout
  - **Dependencies**: INFRA-P1-001, INFRA-P1-002

- [x] **UI-P1-004**: Install and configure shadcn-svelte Data Table component
  - **Success Criteria**:
    - Data Table component added via `npx shadcn-svelte@next add table`
    - Reusable data table wrapper component created at `src/lib/components/data-table/`
    - Supports: column definitions, client-side search filtering, sorting, pagination
    - No URL query parameters or API re-fetches for filtering (client-side only)
    - Search input filters across all visible columns
  - **Dependencies**: INFRA-P1-002

---

## Phase 2: Core Features

*Correlates to Milestones M3 (Weeks 5-8), M4 (Weeks 9-10), M5 (Weeks 11-12)*

### Account Management (F-008)

- [x] **API-P2-001**: Implement Account CRUD API endpoints
  - **Success Criteria**:
    - `GET /api/accounts` returns all accounts for authenticated user
    - `POST /api/accounts` creates new account (name, type, opening_balance)
    - `PUT /api/accounts/[id]` updates account name and type
    - `DELETE /api/accounts/[id]` deactivates account (not hard delete) if no transactions exist; returns error otherwise
    - Account types supported: cash, bank, ewallet
    - All responses include proper HTTP status codes
    - Input validation: name required, balance >= 0
  - **Dependencies**: DB-P1-002, AUTH-P1-004

- [x] **UI-P2-001**: Implement Accounts management page (`/akun`)
  - **Success Criteria**:
    - Page at `src/routes/(app)/akun/+page.svelte` lists all user accounts
    - Each account card shows: name, type icon, current balance in Rp format
    - Total balance across all accounts displayed at top
    - "Tambah Akun" (Add Account) button opens creation form/modal
    - Edit and deactivate actions available per account
    - Empty state: "Belum ada akun. Yuk, buat akun pertama!"
    - All text in Bahasa Indonesia
  - **Browser Validation** (chrome-devtools MCP):
    - Navigate to `/akun` and verify account list renders
    - Click "Tambah Akun" and verify form/modal opens
    - Fill form (name: "Kas Toko", type: cash, balance: 1000000) and submit
    - Verify new account appears in list with correct Rp format
    - Click edit on account and verify form pre-fills with data
    - Verify empty state message when no accounts exist
    - Check Network tab for correct API calls
  - **Dependencies**: API-P2-001, UI-P1-001

### Category Management (F-002)

- [x] **API-P2-002**: Implement Category CRUD API endpoints
  - **Success Criteria**:
    - `GET /api/categories` returns all categories for user (system + custom)
    - `POST /api/categories` creates custom category with name, type (income/expense), parent SAK EMKM group
    - `PUT /api/categories/[id]` renames category (system categories cannot be renamed)
    - `PATCH /api/categories/[id]` toggles `is_active` status
    - Categories with referenced transactions cannot be deleted, only deactivated
    - System categories (is_system: true) cannot be deleted
    - Category code follows SAK EMKM structure
  - **Dependencies**: DB-P1-002, DB-P1-003, AUTH-P1-004

- [x] **UI-P2-002**: Implement Category management page (`/kategori`)
  - **Success Criteria**:
    - Page lists all categories grouped by type (Pemasukan / Pengeluaran)
    - System categories visually distinguished from custom categories
    - "Tambah Kategori" button for adding custom categories
    - Edit (rename) and deactivate toggles available
    - Category hierarchy shown (parent-child)
    - All text in Bahasa Indonesia
  - **Browser Validation** (chrome-devtools MCP):
    - Navigate to `/kategori` and verify categories listed by type
    - Verify system categories are visually distinguished
    - Click "Tambah Kategori" and verify form opens with type and parent group selection
    - Add custom category and verify it appears in the list
    - Attempt to delete system category and verify it is blocked
    - Deactivate a category and verify visual state change
  - **Dependencies**: API-P2-002, UI-P1-001

### Transaction Recording (F-001)

- [x] **API-P2-003**: Implement Transaction CRUD API endpoints
  - **Success Criteria**:
    - `GET /api/transactions` returns paginated transactions with filters (date range, type, category, account)
    - `POST /api/transactions` creates transaction with: amount, type (in/out), category_id, account_id, date, description
    - `PUT /api/transactions/[id]` updates transaction
    - `DELETE /api/transactions/[id]` soft-deletes transaction
    - Amount validation: > 0, integer only, max Rp999,999,999,999
    - Date validation: cannot be in the future
    - Category and account must belong to authenticated user
    - Account balance updated on create/update/delete
    - Response time < 200ms for create
  - **Dependencies**: DB-P1-002, API-P2-001, API-P2-002, AUTH-P1-004

- [x] **UI-P2-003**: Implement Transaction entry form
  - **Success Criteria**:
    - Full-screen form accessible via "+" FAB on dashboard and bottom nav
    - Toggle between "Pemasukan" (income) and "Pengeluaran" (expense)
    - Numeric keypad for amount entry (IDR format, thousands separator)
    - Category picker with scrollable list of active categories filtered by type
    - Account selector dropdown
    - Date picker defaulting to today
    - Optional description text field
    - Optional receipt photo button (camera or gallery)
    - "Simpan" (Save) button
    - Success feedback (toast/snackbar) after save
    - Form resets for quick next entry
    - Entry achievable in <= 3 taps + amount
    - All text in Bahasa Indonesia
  - **Browser Validation** (chrome-devtools MCP):
    - Navigate to transaction entry form via "+" button
    - Verify "Pemasukan" is pre-selected
    - Toggle to "Pengeluaran" and verify category list changes
    - Enter amount "50000" and verify Rp format display (Rp50.000)
    - Select category from picker
    - Select account from dropdown
    - Tap "Simpan" and verify success toast appears
    - Verify form resets after save
    - Check Network tab for POST request with correct payload
    - Verify account balance updated after transaction
  - **Dependencies**: API-P2-003, UI-P1-001, INFRA-P1-006

- [x] **UI-P2-004**: Implement Transaction list page (`/transaksi`)
  - **Success Criteria**:
    - Data Table using shadcn-svelte Data Table component
    - Columns: date, description, category, amount (green for income, red for expense), account
    - Client-side search filtering across description and category
    - Sortable by date and amount
    - Pagination with configurable page size
    - Date range filter (quick presets: Hari Ini, Minggu Ini, Bulan Ini, custom range)
    - Tap on row opens transaction detail/edit view
    - Delete action with confirmation dialog
    - Empty state: "Belum ada transaksi. Yuk, catat yang pertama!"
    - All text in Bahasa Indonesia
  - **Browser Validation** (chrome-devtools MCP):
    - Navigate to `/transaksi` and verify data table loads with transactions
    - Enter search text and verify table filters client-side (no network request)
    - Click column header and verify sorting
    - Use date range filter and verify results update
    - Click row and verify detail/edit view opens
    - Delete a transaction and verify confirmation dialog then removal
    - Verify empty state when no transactions
    - Check Console for no JavaScript errors
  - **Dependencies**: API-P2-003, UI-P1-004

### Receipt Photo Attachment (F-009)

- [x] **API-P2-004**: Implement receipt photo upload API with R2 storage
  - **Success Criteria**:
    - `POST /api/transactions/[id]/photos` uploads photo to R2 and creates `transaction_photo` record
    - Client-side compression to <= 500KB before upload
    - `GET /api/transactions/[id]/photos` returns photo URLs
    - `DELETE /api/transactions/[id]/photos/[photoId]` removes photo from R2 and database
    - Maximum 3 photos per transaction enforced
    - Supported formats: JPEG, PNG
    - Presigned URL generation for R2 upload if needed
  - **Dependencies**: INFRA-P1-004, API-P2-003

- [x] **UI-P2-005**: Implement receipt photo capture and display in transaction form
  - **Success Criteria**:
    - Camera and gallery buttons in transaction entry form
    - Photo preview thumbnails shown after capture/selection
    - Client-side image compression before upload
    - Photos viewable in transaction detail screen
    - Remove photo button with confirmation
    - Counter showing "X/3 foto" (photos)
  - **Browser Validation** (chrome-devtools MCP):
    - Open transaction form and verify camera/gallery buttons present
    - Attach a photo and verify thumbnail preview appears
    - Verify photo counter updates (e.g., "1/3 foto")
    - Save transaction with photo and verify it persists
    - Open transaction detail and verify photo is viewable
    - Check Network tab for upload request to R2
  - **Dependencies**: API-P2-004, UI-P2-003

### Dashboard (F-011, F-012)

- [x] **API-P2-005**: Implement Dashboard data aggregation API
  - **Success Criteria**:
    - `GET /api/dashboard` returns aggregated data in single response:
      - Total balance across all accounts
      - Today's income, expenses, and profit/loss
      - Selected period (daily/weekly/monthly) income, expenses, profit/loss
      - Cumulative annual revenue (for tax threshold)
      - Current month tax amount (PPh Final 0.5%)
      - Total outstanding piutang and hutang
      - Recent 5 transactions
    - Response time < 1 second
    - All monetary values as integers (Rupiah)
  - **Dependencies**: DB-P1-004, API-P2-003

- [x] **UI-P2-006**: Implement Cash Flow Dashboard page (`/beranda`)
  - **Success Criteria**:
    - Dashboard loads in < 1 second
    - Hero card: total balance across all accounts
    - Summary cards: today's pemasukan, pengeluaran, and laba/rugi (profit/loss)
    - Period toggle: Hari Ini / Minggu Ini / Bulan Ini
    - Visual chart (bar or line) showing income vs expense trend
    - Tax status widget: threshold progress bar (WP OP) or amount due (WP Badan)
    - Outstanding piutang/hutang summary with totals
    - Recent transactions list (last 5)
    - FAB "+" button to quick-add transaction
    - All text in Bahasa Indonesia
    - Skeleton loading states (not spinners)
  - **Browser Validation** (chrome-devtools MCP):
    - Navigate to `/beranda` and verify dashboard loads with all widgets
    - Verify total balance displays in Rp format
    - Toggle period selector and verify summary cards update
    - Verify chart renders with income/expense data
    - Verify tax widget shows threshold progress or amount
    - Verify piutang/hutang summary displays
    - Verify recent transactions list shows last 5
    - Click "+" FAB and verify transaction form opens
    - Verify skeleton loading states appear during data fetch
    - Check Console for no errors
  - **Dependencies**: API-P2-005, UI-P1-001, INFRA-P1-006

- [x] **UI-P2-007**: Implement Profit/Loss summary view
  - **Success Criteria**:
    - Accessible from dashboard and dedicated section in `/laporan`
    - Profit/Loss = total pemasukan - total pengeluaran for selected period
    - Breakdown by category (pie or bar chart)
    - Period comparison: "naik/turun X% dari bulan lalu"
    - Daily, weekly, monthly, yearly period selection
    - All text in Bahasa Indonesia
  - **Browser Validation** (chrome-devtools MCP):
    - Navigate to profit/loss view and verify calculation is correct
    - Switch periods and verify values update
    - Verify category breakdown chart renders
    - Verify period comparison text displays correctly
  - **Dependencies**: API-P2-005, UI-P2-006

- [x] **UI-P2-008**: Integrate lightweight charting library for dashboard
  - **Success Criteria**:
    - Chart library installed (LayerChart or lightweight alternative)
    - Bar/line chart component renders income vs expense over time
    - Chart is responsive and renders on mobile
    - Minimal bundle size impact (< 30KB gzipped)
    - SSR-compatible (no window/document errors on server)
  - **Dependencies**: INFRA-P1-001

### Debt & Receivable Tracking (F-003)

- [x] **API-P2-006**: Implement Debt (Piutang/Hutang) CRUD API
  - **Success Criteria**:
    - `GET /api/debts` returns all debts for user with status filter (active/settled)
    - `POST /api/debts` creates debt with: type (piutang/hutang), contact_name, amount, due_date, note
    - `PUT /api/debts/[id]` updates debt details
    - `DELETE /api/debts/[id]` soft-deletes debt
    - Debt amount stored as integer, remaining balance auto-calculated
    - New debt sets `remaining = amount` and `status = "aktif"`
  - **Dependencies**: DB-P1-002, AUTH-P1-004

- [x] **API-P2-007**: Implement Debt Payment recording API
  - **Success Criteria**:
    - `POST /api/debts/[id]/payments` creates payment with amount and date
    - Payment creates a corresponding transaction (income for piutang payment, expense for hutang payment)
    - Payment amount cannot exceed remaining balance
    - Remaining balance auto-decremented
    - When remaining = 0, debt status changes to "lunas" (settled)
    - Partial payments supported
    - `GET /api/debts/[id]/payments` returns payment history
  - **Dependencies**: API-P2-006, API-P2-003

- [x] **UI-P2-009**: Implement Piutang/Hutang list page (`/hutang-piutang`)
  - **Success Criteria**:
    - Data Table with tabs or toggle: Piutang / Hutang
    - Columns: contact name, total amount, remaining, due date, status
    - Client-side search filtering by contact name
    - Status badges: "Aktif" (outstanding), "Lunas" (settled)
    - Summary cards at top: total piutang, total hutang
    - "Tambah Piutang" / "Tambah Hutang" buttons
    - Tap row to view detail and payment history
    - Empty state: "Belum ada catatan hutang/piutang."
    - All text in Bahasa Indonesia
  - **Browser Validation** (chrome-devtools MCP):
    - Navigate to `/hutang-piutang` and verify data table renders
    - Toggle between Piutang and Hutang tabs
    - Search by contact name and verify client-side filtering
    - Click "Tambah Piutang" and verify creation form
    - Fill form and submit and verify new entry appears
    - Click on entry and verify detail view with payment history
    - Verify summary cards show correct totals
    - Verify empty state message
  - **Dependencies**: API-P2-006, UI-P1-004

- [x] **UI-P2-010**: Implement Debt detail page with payment recording
  - **Success Criteria**:
    - Detail view shows: contact name, original amount, remaining balance, due date, status, notes
    - Payment history list showing date and amount of each payment
    - "Catat Pembayaran" (Record Payment) button opens form
    - Payment form: amount field (pre-filled with remaining balance), date
    - Amount validation: cannot exceed remaining balance
    - Upon full payment, status badge changes to "Lunas"
    - All text in Bahasa Indonesia
  - **Browser Validation** (chrome-devtools MCP):
    - Open debt detail view and verify all fields display
    - Click "Catat Pembayaran" and verify form opens
    - Enter payment amount exceeding remaining balance and verify error
    - Enter valid partial payment and verify remaining balance updates
    - Enter final payment and verify status changes to "Lunas"
    - Verify payment history list updates with each payment
    - Check Network tab for correct API calls
  - **Dependencies**: API-P2-007, UI-P2-009

### Tax Engine (F-004, F-005, F-006, F-007)

- [x] **FEAT-P2-001**: Implement PPh Final 0.5% tax calculation engine
  - **Success Criteria**:
    - Tax engine module at `src/lib/server/tax/` or `src/lib/tax/`
    - Calculates monthly PPh Final = 0.5% x gross monthly revenue
    - For WP OP: tracks cumulative annual revenue against Rp500M threshold
    - When cumulative <= Rp500M: tax = 0
    - When cumulative > Rp500M: tax = 0.5% x monthly revenue (for months after threshold exceeded)
    - Mid-month threshold crossing: only revenue above threshold is taxed for that month
    - For WP Badan: tax = 0.5% x monthly revenue from month 1 (no threshold)
    - Tax year resets on January 1
    - Revenue = gross total pemasukan (not net profit)
    - Tax rates and thresholds stored as configuration (not hardcoded)
    - Comprehensive unit tests with edge cases (threshold crossing, year boundary, zero revenue months)
  - **Dependencies**: DB-P1-004

- [x] **API-P2-008**: Implement Tax data API endpoints
  - **Success Criteria**:
    - `GET /api/tax/summary` returns: current month gross revenue, tax amount, cumulative annual revenue, threshold percentage, payment status
    - `GET /api/tax/history` returns monthly tax records for selected year
    - `POST /api/tax/[year]/[month]/mark-paid` marks tax as paid with payment date
    - `GET /api/tax/billing-code/[year]/[month]` returns billing code prep data (KAP, KJS, NPWP, amount, period)
    - Tax records auto-generated/updated when transactions are created/modified
  - **Dependencies**: FEAT-P2-001, DB-P1-004, AUTH-P1-004

- [x] **UI-P2-011**: Implement Tax overview page (`/pajak`)
  - **Success Criteria**:
    - Tax page shows:
      - Threshold progress bar for WP OP (Rp X dari Rp500.000.000) with color coding: green (< 70%), yellow (70-90%), red (> 90%)
      - Current month tax amount due (or "Belum kena pajak" if below threshold)
      - Monthly tax status: "Belum Dibayar" / "Sudah Dibayar"
      - Tax payment history table (month, gross revenue, tax amount, status)
      - "Tandai Sudah Dibayar" button for current month
    - Alert/notification at 80% and 100% threshold
    - Only threshold bar visible for WP OP accounts
    - All text in Bahasa Indonesia
  - **Browser Validation** (chrome-devtools MCP):
    - Navigate to `/pajak` and verify tax page renders
    - Verify threshold progress bar shows correct percentage and color
    - Verify current month tax amount or "Belum kena pajak" message
    - Click "Tandai Sudah Dibayar" and verify confirmation dialog
    - Confirm payment and verify status changes to "Sudah Dibayar"
    - Verify tax history table shows monthly records
    - Verify threshold alerts at 80% and 100%
  - **Dependencies**: API-P2-008, UI-P1-001

- [x] **UI-P2-012**: Implement Tax billing code prep page
  - **Success Criteria**:
    - Displays billing code summary: NPWP, Nama WP, KAP (411128), KJS (420), Masa Pajak, Tahun Pajak, Jumlah Setor
    - Each field individually copyable (tap-to-copy with toast confirmation)
    - "Export PDF" button generates printable summary
    - Data pre-filled from user profile and calculated tax
    - All text in Bahasa Indonesia
  - **Browser Validation** (chrome-devtools MCP):
    - Navigate to billing code prep page for a specific month
    - Verify all fields display correctly (NPWP, KAP, KJS, amount, period)
    - Tap copy button on each field and verify clipboard copy + toast
    - Click "Export PDF" and verify PDF download
    - Verify all data matches tax calculation
  - **Dependencies**: API-P2-008, UI-P2-011

- [x] **FEAT-P2-002**: Implement monthly tax payment reminders (in-app)
  - **Success Criteria**:
    - In-app notification/banner appears starting 1st of the month for previous month's tax
    - Visual prominence increases as 15th approaches (color change, larger banner)
    - Reminder includes: tax period, amount due, link to billing code prep page
    - Reminder dismissed after user marks tax as "Sudah Dibayar"
    - Reminder logic: only show if cumulative revenue > Rp500M (for WP OP) or always (for WP Badan)
  - **Dependencies**: FEAT-P2-001, UI-P2-011

### Transfer Between Accounts

- [x] **API-P2-009**: Implement account-to-account transfer API
  - **Success Criteria**:
    - `POST /api/transfers` creates paired transactions (out from source, in to destination)
    - Both transactions linked via a `transfer_id` or reference
    - Source account balance decremented, destination account balance incremented
    - Transfer amount validation: > 0, cannot exceed source account balance
    - Transfer appears in transaction list with "Transfer" category
  - **Dependencies**: API-P2-003, API-P2-001

- [x] **UI-P2-013**: Implement transfer between accounts UI
  - **Success Criteria**:
    - Transfer form accessible from accounts page or transaction entry
    - Source account and destination account dropdowns
    - Amount field with validation
    - Cannot select same account for source and destination
    - Success feedback after transfer
  - **Browser Validation** (chrome-devtools MCP):
    - Open transfer form and verify source/destination dropdowns
    - Select same account for both and verify error
    - Enter valid transfer and submit
    - Verify both account balances update correctly
    - Verify paired transactions appear in transaction list
  - **Dependencies**: API-P2-009, UI-P2-001

---

## Phase 3: Reports, Export, Offline & Polish

*Correlates to Milestones M6 (Weeks 13-14), M7 (Weeks 13-15), M8 (Weeks 15-16), M9 (Week 16)*

### SAK EMKM Financial Reports (F-010)

- [x] **FEAT-P3-001**: Implement Laporan Laba Rugi (Income Statement) generator
  - **Success Criteria**:
    - Calculates revenue, expenses by SAK EMKM category, and net income for selected period
    - Period options: monthly, quarterly, annually
    - Revenue grouped by 4xxx categories
    - Expenses grouped by 5xxx-8xxx categories (including HPP)
    - Net income = total revenue - total expenses
    - All labels in Bahasa Indonesia with proper accounting terminology
    - Data sourced from transaction records
  - **Dependencies**: DB-P1-004, API-P2-003

- [x] **FEAT-P3-002**: Implement Laporan Posisi Keuangan (Balance Sheet) generator
  - **Success Criteria**:
    - Shows assets (1xxx), liabilities (2xxx), and equity (3xxx) for selected date
    - Assets include: cash/bank account balances, outstanding piutang
    - Liabilities include: outstanding hutang
    - Equity = assets - liabilities (auto-calculated)
    - Balance sheet equation maintained: Assets = Liabilities + Equity
    - All labels in Bahasa Indonesia
  - **Dependencies**: DB-P1-004, API-P2-001, API-P2-006

- [x] **FEAT-P3-003**: Implement Catatan atas Laporan Keuangan (Notes) generator
  - **Success Criteria**:
    - Includes: business name, reporting period, accounting policies description
    - States: cash-basis accounting, SAK EMKM compliance, functional currency (IDR)
    - Auto-populated from business profile
    - All text in Bahasa Indonesia
  - **Dependencies**: DB-P1-004

- [x] **UI-P3-001**: Implement Reports page (`/laporan`)
  - **Success Criteria**:
    - Report type selector: Laba Rugi, Posisi Keuangan, Catatan atas Laporan Keuangan
    - Period picker: month selector or date range
    - On-screen preview of selected report
    - Export buttons: "Export PDF" and "Export Excel"
    - Professional formatting with proper table alignment
    - Empty state if insufficient data with guidance
    - All text in Bahasa Indonesia
  - **Browser Validation** (chrome-devtools MCP):
    - Navigate to `/laporan` and verify report type selector
    - Select "Laba Rugi" and monthly period and verify report preview
    - Verify revenue and expense categories display correctly
    - Verify net income calculation is correct
    - Select "Posisi Keuangan" and verify balance sheet preview
    - Click "Export PDF" and verify PDF download
    - Click "Export Excel" and verify Excel download
    - Verify empty state with no transaction data
  - **Dependencies**: FEAT-P3-001, FEAT-P3-002, FEAT-P3-003

### Export Functionality (F-013, F-014, F-021)

- [x] **FEAT-P3-004**: Implement Excel/CSV export for transactions
  - **Success Criteria**:
    - User can select date range for export
    - Excel (.xlsx) file with proper headers, column widths, and formatting
    - CSV with UTF-8 BOM encoding for proper Bahasa Indonesia character support
    - Export includes: date, description, category, amount, account, type (Pemasukan/Pengeluaran)
    - File downloadable and shareable
    - Library used: SheetJS or similar lightweight library
  - **Dependencies**: API-P2-003

- [x] **FEAT-P3-005**: Implement PDF export for financial reports
  - **Success Criteria**:
    - PDF generation for Laba Rugi, Posisi Keuangan, and Catatan reports
    - PDF includes: business name, logo (if set), period, report content
    - A4 format, professional print-ready layout
    - Tables properly aligned with page breaks
    - Library used: jsPDF or similar client-side PDF generation
    - File downloadable and shareable
  - **Dependencies**: FEAT-P3-001, FEAT-P3-002, FEAT-P3-003

- [x] **FEAT-P3-006**: Implement SPT Tahunan (Annual Tax Return) data export
  - **Success Criteria**:
    - User selects tax year
    - Export includes: monthly gross revenue, monthly PPh Final paid, annual totals, net income
    - Available as Excel and PDF
    - Data matches F-004 tax calculations exactly
    - Formatted for easy handoff to tax consultant
  - **Dependencies**: API-P2-008, FEAT-P3-004, FEAT-P3-005

- [x] **UI-P3-002**: Implement export UI controls in transaction list and reports
  - **Success Criteria**:
    - Export button in transaction list page with format picker (Excel/CSV)
    - Date range selector for transaction export
    - Export buttons in reports page (PDF/Excel per report type)
    - Loading state during export generation
    - Success toast with download link
  - **Browser Validation** (chrome-devtools MCP):
    - Navigate to `/transaksi` and click export button
    - Select date range and format (Excel) and verify download
    - Navigate to `/laporan`, generate a report, and click Export PDF
    - Verify PDF downloads with correct content
    - Verify loading states appear during generation
  - **Dependencies**: FEAT-P3-004, FEAT-P3-005, UI-P2-004, UI-P3-001

### Tax Billing Code PDF Export

- [x] **FEAT-P3-007**: Implement tax billing code summary PDF export
  - **Success Criteria**:
    - PDF includes: NPWP, Nama WP, KAP (411128), KJS (420), Masa Pajak, Tahun Pajak, Jumlah Setor
    - Professional A4 format suitable for reference during DJP Online entry
    - Data matches calculated tax amount
  - **Dependencies**: API-P2-008, FEAT-P3-005

### Offline-First PWA (F-016)

- [x] **FEAT-P3-008**: Implement Service Worker for PWA asset caching
  - **Success Criteria**:
    - Service Worker registered in app entry point
    - All static assets (JS, CSS, images, fonts) cached on first visit
    - App shell loads fully from cache when offline
    - Versioned cache keys for proper invalidation on deploy
    - Forced update mechanism when new version available
    - PWA manifest (`manifest.json`) with app name, icons, theme color, display: standalone
    - App installable as PWA on Android Chrome and iOS Safari
  - **Browser Validation** (chrome-devtools MCP):
    - Open Application tab and verify Service Worker registered
    - Verify manifest.json parsed correctly with app details
    - Check Cache Storage for cached static assets
    - Go offline (Network tab -> Offline) and verify app shell loads
    - Verify "Install" prompt appears on Android Chrome
  - **Dependencies**: None

- [x] **FEAT-P3-009**: Implement IndexedDB local storage for offline data
  - **Success Criteria**:
    - IndexedDB database created with stores mirroring D1 schema (transactions, accounts, categories, debts, tax_records)
    - All CRUD operations write to IndexedDB first (local-first)
    - Data persists across browser sessions
    - IndexedDB library chosen (Dexie.js or idb) with minimal bundle impact
    - Storage usage monitored (warn user if approaching device limits)
  - **Dependencies**: DB-P1-001

- [x] **FEAT-P3-010**: Implement offline-to-online sync engine
  - **Success Criteria**:
    - Sync occurs automatically when connectivity returns
    - Pending changes tracked with sync status (pending/synced/error)
    - Visual sync status indicator in app header or settings
    - Conflict resolution: last-write-wins with user notification for conflicts
    - Sync of 100 transactions completes in < 10 seconds
    - Offline data is source of truth until sync confirmed
    - Cloud data does not overwrite unsynced local changes
    - Sync error recovery: retry with exponential backoff
  - **Dependencies**: FEAT-P3-009, API-P2-003

- [ ] **UI-P3-003**: Implement sync status indicator UI
  - **Success Criteria**:
    - Visual indicator in app header: synced (green check), pending (yellow clock), error (red exclamation)
    - Tap indicator shows detail: "X transaksi menunggu sinkronisasi"
    - Manual sync button available
    - Offline mode indicator: "Mode Offline" banner when disconnected
    - No error states for offline use (offline is normal state)
    - All text in Bahasa Indonesia
  - **Browser Validation** (chrome-devtools MCP):
    - Verify sync indicator shows green when online and synced
    - Go offline and verify "Mode Offline" banner appears
    - Create transaction offline and verify sync indicator shows pending
    - Go online and verify sync indicator returns to synced
    - Verify tap on indicator shows pending count
  - **Dependencies**: FEAT-P3-010, UI-P1-001

### Onboarding (F-018)

- [ ] **UI-P3-004**: Implement 3-step onboarding wizard
  - **Success Criteria**:
    - Wizard launches after first registration
    - Step 1: Business name (Nama Usaha) and owner name
    - Step 2: Business type selection (warung makan, toko kelontong, jasa, manufaktur) — triggers CoA template seeding
    - Step 3: Create first account (e.g., "Kas Toko") with type and optional opening balance
    - After wizard: prompt to record first transaction with guidance overlay
    - Progress indicator showing current step
    - Wizard can be skipped and completed later from Settings
    - Total completion time <= 90 seconds
    - All text in Bahasa Indonesia with friendly, supportive tone
  - **Browser Validation** (chrome-devtools MCP):
    - Register new user and verify wizard launches
    - Step 1: Enter business name and owner name, click "Lanjut"
    - Step 2: Select business type, verify CoA template shown, click "Lanjut"
    - Step 3: Enter account name and opening balance, click "Selesai"
    - Verify redirect to dashboard with first-transaction guidance
    - Verify business profile saved correctly
    - Verify categories seeded based on business type
    - Verify account created with correct opening balance
    - Test skip functionality and verify wizard accessible from Settings
  - **Dependencies**: API-P2-001, API-P2-002, DB-P1-003, UI-P1-002

- [ ] **FEAT-P3-011**: Implement business profile CRUD
  - **Success Criteria**:
    - `GET /api/profile` returns business profile for authenticated user
    - `PUT /api/profile` updates business profile (name, type, address, npwp, logo)
    - Profile created during onboarding wizard
    - NPWP format validation (15 or 16 digits)
    - NPWP stored encrypted at application level (PII protection)
    - Profile data used for report generation headers
  - **Dependencies**: DB-P1-002, AUTH-P1-004

### Transaction Templates (F-019)

- [ ] **API-P2-010**: Implement Transaction Templates CRUD API
  - **Success Criteria**:
    - `GET /api/templates` returns all templates for user (system + custom)
    - `POST /api/templates` creates custom template with: name, type (in/out), category_id, description
    - `PUT /api/templates/[id]` updates template
    - `DELETE /api/templates/[id]` deletes custom template
    - Default templates seeded based on business type during onboarding
  - **Dependencies**: DB-P1-002, API-P2-002, AUTH-P1-004

- [ ] **UI-P3-005**: Implement transaction templates in transaction entry form
  - **Success Criteria**:
    - Quick-entry template buttons displayed above/below amount entry
    - Default templates: "Penjualan Tunai," "Bayar Supplier," "Bayar Sewa," "Beli Stok" (based on business type)
    - Tapping template pre-fills: type, category, description
    - User only needs to enter amount and confirm (2 taps + amount)
    - "Kelola Template" link to manage custom templates
    - All text in Bahasa Indonesia
  - **Browser Validation** (chrome-devtools MCP):
    - Open transaction form and verify template buttons displayed
    - Tap "Penjualan Tunai" template and verify type, category, description pre-filled
    - Enter amount and save — verify transaction created correctly
    - Tap "Kelola Template" and verify template management page
    - Create custom template and verify it appears in transaction form
  - **Dependencies**: API-P2-010, UI-P2-003

### Backup & Restore (F-020)

- [ ] **FEAT-P3-012**: Implement data backup generation
  - **Success Criteria**:
    - `POST /api/backup` generates backup file containing all user data: transactions, categories, accounts, debts, tax records, profile, settings
    - Backup file is JSON format with schema version and metadata (app version, backup date, business name)
    - Backup downloadable to device storage
    - Backup accessible from Settings page
  - **Dependencies**: DB-P1-004, AUTH-P1-004

- [ ] **FEAT-P3-013**: Implement data restore from backup
  - **Success Criteria**:
    - `POST /api/restore` accepts backup file and overwrites local data
    - Schema version validation before applying restore
    - Confirmation dialog with clear warning about data overwrite
    - Restore validates data integrity before applying
    - Forward-compatible: newer app version can restore older backup
  - **Dependencies**: FEAT-P3-012

- [ ] **UI-P3-006**: Implement backup/restore UI in Settings
  - **Success Criteria**:
    - Settings page section: "Cadangkan & Pulihkan Data"
    - "Cadangkan Data" button triggers backup download
    - "Pulihkan Data" button opens file picker for backup file
    - Restore shows confirmation dialog: "Apakah Anda yakin? Data saat ini akan ditimpa."
    - Last backup date shown
    - All text in Bahasa Indonesia
  - **Browser Validation** (chrome-devtools MCP):
    - Navigate to Settings and find backup/restore section
    - Click "Cadangkan Data" and verify file downloads
    - Click "Pulihkan Data" and select a backup file
    - Verify confirmation dialog appears with warning
    - Confirm restore and verify data replaced
    - Verify last backup date updates after backup
  - **Dependencies**: FEAT-P3-012, FEAT-P3-013

### Settings Page

- [ ] **UI-P3-007**: Implement Settings page (`/pengaturan`)
  - **Success Criteria**:
    - Accessible from "Lainnya" (More) bottom nav item
    - Sections: Profil Usaha (business profile), Akun Saya (my account), Cadangan (backup), Tentang (about)
    - Business profile editing: name, type, address, NPWP, logo
    - Account settings: email, change password
    - Backup/restore section
    - App version and "Dibuat dengan cinta untuk UMKM Indonesia" footer
    - Tax disclaimer text
    - Logout button
    - All text in Bahasa Indonesia
  - **Browser Validation** (chrome-devtools MCP):
    - Navigate to `/pengaturan` and verify all sections render
    - Edit business profile and save — verify changes persist
    - Verify logout button works and redirects to landing page
    - Verify app version displays correctly
    - Verify tax disclaimer is visible
  - **Dependencies**: FEAT-P3-011, AUTH-P1-005, UI-P3-006

### Mobile Responsive Design (F-017)

- [ ] **UI-P3-008**: Implement mobile-optimized responsive design across all pages
  - **Success Criteria**:
    - Touch targets >= 48px on all interactive elements
    - Bottom navigation accessible with one hand
    - Numeric keypad for amount entry on transaction form
    - Minimum font size: 14px body, 16px inputs
    - Smooth performance on 2GB RAM devices (< 100MB memory usage)
    - No horizontal scroll on any page at 320px-414px width
    - Responsive layout works on desktop but mobile is primary
    - 5.5"–6.7" screen optimization
  - **Browser Validation** (chrome-devtools MCP):
    - Emulate Xiaomi Redmi 10 (6.5" 1080x2400) and navigate all pages
    - Verify all touch targets >= 48px
    - Verify no horizontal scroll on any page
    - Verify amount entry uses numeric keypad
    - Verify bottom nav accessible with one-hand reach
    - Check Performance tab for memory usage < 100MB
    - Emulate desktop and verify layout adapts
  - **Dependencies**: UI-P2-003, UI-P2-004, UI-P2-006, UI-P2-009, UI-P2-011

### Bahasa Indonesia Review (F-015)

- [ ] **UI-P3-009**: Comprehensive Bahasa Indonesia UI language review
  - **Success Criteria**:
    - Zero English-only strings in user-facing interface
    - Accounting terms in plain Indonesian: "Pemasukan" not "Revenue", "Hutang" not "Accounts Payable"
    - All error messages in Bahasa Indonesia with helpful, non-technical language
    - Date format: DD/MM/YYYY
    - Currency format: Rp1.000.000 (dot as thousands separator)
    - All empty states have Indonesian guidance text
    - Placeholder text in all form fields in Indonesian
  - **Browser Validation** (chrome-devtools MCP):
    - Navigate through every page and screen in the app
    - Verify no English text appears in any user-facing element
    - Verify date formats show DD/MM/YYYY
    - Verify currency shows Rp with dot separators
    - Trigger error states and verify messages are in Indonesian
    - Verify empty states have Indonesian guidance
  - **Dependencies**: INFRA-P1-006, all UI tasks

### Empty States & UX Polish

- [ ] **UI-P3-010**: Implement empty states for all pages
  - **Success Criteria**:
    - Every data-driven page has an empty state with:
      - Illustration or icon
      - Friendly message in Bahasa Indonesia
      - CTA button to create first item
    - Examples:
      - Dashboard: "Selamat datang! Yuk, catat transaksi pertamamu."
      - Transactions: "Belum ada transaksi. Yuk, catat yang pertama!"
      - Debts: "Belum ada catatan hutang/piutang."
      - Tax: "Belum ada pemasukan tercatat."
    - No blank screens anywhere in the app
  - **Browser Validation** (chrome-devtools MCP):
    - Create new user account and navigate all pages
    - Verify every page shows appropriate empty state (not blank)
    - Verify CTA buttons in empty states navigate to creation forms
    - Verify illustrations/icons are present
  - **Dependencies**: All UI tasks

- [ ] **UI-P3-011**: Implement loading states (skeleton screens)
  - **Success Criteria**:
    - Skeleton screens used for all data-loading states (not spinners)
    - Skeleton matches the layout shape of the loaded content
    - Dashboard: skeleton cards for balance, summary, chart
    - Transaction list: skeleton rows
    - Reports: skeleton report layout
    - Loading states appear for < 1 second on typical connection
  - **Browser Validation** (chrome-devtools MCP):
    - Throttle network to Slow 3G in Network tab
    - Navigate to each page and verify skeleton screens appear
    - Verify skeletons match shape of actual content
    - Verify no spinners are used
  - **Dependencies**: All UI tasks

- [ ] **UI-P3-012**: Implement confirmation dialogs for destructive actions
  - **Success Criteria**:
    - Confirmation dialog before: delete transaction, delete debt, restore backup, mark tax as paid
    - Dialog uses shadcn-svelte AlertDialog component
    - Clear warning text in Bahasa Indonesia
    - "Batal" (Cancel) and "Hapus" / "Lanjutkan" buttons with appropriate styling
    - Destructive button uses red/danger color
  - **Dependencies**: INFRA-P1-002

### Accessibility (WCAG AA)

- [ ] **UI-P3-013**: Implement WCAG AA accessibility compliance
  - **Success Criteria**:
    - Color contrast >= 4.5:1 for all text
    - ARIA labels on all interactive elements
    - Full keyboard navigation on desktop
    - Touch targets >= 48px x 48px
    - Font sizes: minimum 14px body, 16px inputs
    - Screen reader compatible: all images have alt text, form labels present
    - Focus indicators visible on all focusable elements
  - **Browser Validation** (chrome-devtools MCP):
    - Run Lighthouse accessibility audit and verify score >= 90
    - Tab through all pages and verify focus indicators visible
    - Verify ARIA labels present on all buttons and inputs
    - Check color contrast ratios in Elements inspector
  - **Dependencies**: All UI tasks

---

---
## Summary

### Key Dependencies & Blockers

| Blocker | Impact | Task ID |
|---|---|---|
| TailwindCSS + shadcn-svelte setup | Blocks all UI development | INFRA-P1-001, INFRA-P1-002 |
| Better Auth schema generation | Blocks database schema and all auth | AUTH-P1-001 |
| Complete Drizzle schema | Blocks all API and feature work | DB-P1-001 |
| D1 migration | Blocks all data operations | DB-P1-002 |
| Tax engine implementation | Blocks tax UI and SPT export | FEAT-P2-001 |
| IndexedDB + Sync engine | Blocks offline functionality | FEAT-P3-009, FEAT-P3-010 |
| Production D1/R2/KV setup | Blocks production deployment | DEPLOY-P4-001 through DEPLOY-P4-003 |
