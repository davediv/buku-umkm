# Project TODO List

*Generated from PRD.md on 2026-03-12*

## Executive Summary

Buku UMKM is a free, open-source, offline-first PWA for Indonesian UMKM bookkeeping with integrated PPh Final 0.5% tax compliance. The tech stack is SvelteKit (Svelte 5), Cloudflare Workers/D1/R2/KV, Drizzle ORM, Better Auth, shadcn-svelte, and TailwindCSS v4.

---

## Phase 1: Foundation & Setup

*Correlates to Milestone M1 (Weeks 1-2) and M2 (Weeks 3-4)*

### Infrastructure & Environment

- [x] **INFRA-P1-001**: Install and configure TailwindCSS v4 with Vite — [`.claude/plans/INFRA-P1-001.md`](.claude/plans/INFRA-P1-001.md)

- [x] **INFRA-P1-002**: Install and configure shadcn-svelte component library — [`.claude/plans/INFRA-P1-002.md`](.claude/plans/INFRA-P1-002.md)

- [x] **INFRA-P1-003**: Install @lucide/svelte icon package (Svelte 5) — [`.claude/plans/INFRA-P1-003.md`](.claude/plans/INFRA-P1-003.md)

- [x] **INFRA-P1-004**: Configure Cloudflare R2 binding for receipt photo storage — [`.claude/plans/INFRA-P1-004.md`](.claude/plans/INFRA-P1-004.md)

- [x] **INFRA-P1-005**: Configure Cloudflare KV binding for session/cache — [`.claude/plans/INFRA-P1-005.md`](.claude/plans/INFRA-P1-005.md)

- [x] **INFRA-P1-006**: Set up Bahasa Indonesia i18n message file architecture — [`.claude/plans/INFRA-P1-006.md`](.claude/plans/INFRA-P1-006.md)

- [x] **INFRA-P1-007**: Configure Content Security Policy headers — [`.claude/plans/INFRA-P1-007.md`](.claude/plans/INFRA-P1-007.md)

- [x] **INFRA-P1-008**: Configure rate limiting via Cloudflare WAF rules — [`.claude/plans/INFRA-P1-008.md`](.claude/plans/INFRA-P1-008.md)

### Database & Data Models

- [x] **DB-P1-001**: Design and implement complete Drizzle ORM schema for all MVP entities — [`.claude/plans/DB-P1-001.md`](.claude/plans/DB-P1-001.md)

- [x] **DB-P1-002**: Generate and apply D1 database migration — [`.claude/plans/DB-P1-002.md`](.claude/plans/DB-P1-002.md)

- [x] **DB-P1-003**: Create seed data for SAK EMKM Chart of Accounts templates — [`.claude/plans/DB-P1-003.md`](.claude/plans/DB-P1-003.md)

- [x] **DB-P1-004**: Create database query helper functions (data access layer) — [`.claude/plans/DB-P1-004.md`](.claude/plans/DB-P1-004.md)

### Authentication & Authorization

- [x] **AUTH-P1-001**: Generate Better Auth schema and complete auth setup — [`.claude/plans/AUTH-P1-001.md`](.claude/plans/AUTH-P1-001.md)

- [x] **AUTH-P1-002**: Implement user registration API with email/password — [`.claude/plans/AUTH-P1-002.md`](.claude/plans/AUTH-P1-002.md)

- [x] **AUTH-P1-003**: Implement user login API with session management — [`.claude/plans/AUTH-P1-003.md`](.claude/plans/AUTH-P1-003.md)

- [x] **AUTH-P1-004**: Implement auth guards for protected routes — [`.claude/plans/AUTH-P1-004.md`](.claude/plans/AUTH-P1-004.md)

- [x] **AUTH-P1-005**: Implement logout functionality — [`.claude/plans/AUTH-P1-005.md`](.claude/plans/AUTH-P1-005.md)

### User Interface Foundation

- [x] **UI-P1-001**: Create mobile-first app shell layout with bottom navigation — [`.claude/plans/UI-P1-001.md`](.claude/plans/UI-P1-001.md)

- [x] **UI-P1-002**: Create authentication pages (Masuk / Daftar) — [`.claude/plans/UI-P1-002.md`](.claude/plans/UI-P1-002.md)

- [x] **UI-P1-003**: Create landing page at root route `/` — [`.claude/plans/UI-P1-003.md`](.claude/plans/UI-P1-003.md)

- [x] **UI-P1-004**: Install and configure shadcn-svelte Data Table component — [`.claude/plans/UI-P1-004.md`](.claude/plans/UI-P1-004.md)

---

## Phase 2: Core Features

*Correlates to Milestones M3 (Weeks 5-8), M4 (Weeks 9-10), M5 (Weeks 11-12)*

### Account Management (F-008)

- [x] **API-P2-001**: Implement Account CRUD API endpoints — [`.claude/plans/API-P2-001.md`](.claude/plans/API-P2-001.md)

- [x] **UI-P2-001**: Implement Accounts management page (`/akun`) — [`.claude/plans/UI-P2-001.md`](.claude/plans/UI-P2-001.md)

### Category Management (F-002)

- [x] **API-P2-002**: Implement Category CRUD API endpoints — [`.claude/plans/API-P2-002.md`](.claude/plans/API-P2-002.md)

- [x] **UI-P2-002**: Implement Category management page (`/kategori`) — [`.claude/plans/UI-P2-002.md`](.claude/plans/UI-P2-002.md)

### Transaction Recording (F-001)

- [x] **API-P2-003**: Implement Transaction CRUD API endpoints — [`.claude/plans/API-P2-003.md`](.claude/plans/API-P2-003.md)

- [x] **UI-P2-003**: Implement Transaction entry form — [`.claude/plans/UI-P2-003.md`](.claude/plans/UI-P2-003.md)

- [x] **UI-P2-004**: Implement Transaction list page (`/transaksi`) — [`.claude/plans/UI-P2-004.md`](.claude/plans/UI-P2-004.md)

### Receipt Photo Attachment (F-009)

- [x] **API-P2-004**: Implement receipt photo upload API with R2 storage — [`.claude/plans/API-P2-004.md`](.claude/plans/API-P2-004.md)

- [x] **UI-P2-005**: Implement receipt photo capture and display in transaction form — [`.claude/plans/UI-P2-005.md`](.claude/plans/UI-P2-005.md)

### Dashboard (F-011, F-012)

- [x] **API-P2-005**: Implement Dashboard data aggregation API — [`.claude/plans/API-P2-005.md`](.claude/plans/API-P2-005.md)

- [x] **UI-P2-006**: Implement Cash Flow Dashboard page (`/beranda`) — [`.claude/plans/UI-P2-006.md`](.claude/plans/UI-P2-006.md)

- [x] **UI-P2-007**: Implement Profit/Loss summary view — [`.claude/plans/UI-P2-007.md`](.claude/plans/UI-P2-007.md)

- [x] **UI-P2-008**: Integrate lightweight charting library for dashboard — [`.claude/plans/UI-P2-008.md`](.claude/plans/UI-P2-008.md)

### Debt & Receivable Tracking (F-003)

- [x] **API-P2-006**: Implement Debt (Piutang/Hutang) CRUD API — [`.claude/plans/API-P2-006.md`](.claude/plans/API-P2-006.md)

- [x] **API-P2-007**: Implement Debt Payment recording API — [`.claude/plans/API-P2-007.md`](.claude/plans/API-P2-007.md)

- [x] **UI-P2-009**: Implement Piutang/Hutang list page (`/hutang-piutang`) — [`.claude/plans/UI-P2-009.md`](.claude/plans/UI-P2-009.md)

- [x] **UI-P2-010**: Implement Debt detail page with payment recording — [`.claude/plans/UI-P2-010.md`](.claude/plans/UI-P2-010.md)

### Tax Engine (F-004, F-005, F-006, F-007)

- [x] **FEAT-P2-001**: Implement PPh Final 0.5% tax calculation engine — [`.claude/plans/FEAT-P2-001.md`](.claude/plans/FEAT-P2-001.md)

- [x] **API-P2-008**: Implement Tax data API endpoints — [`.claude/plans/API-P2-008.md`](.claude/plans/API-P2-008.md)

- [x] **UI-P2-011**: Implement Tax overview page (`/pajak`) — [`.claude/plans/UI-P2-011.md`](.claude/plans/UI-P2-011.md)

- [x] **UI-P2-012**: Implement Tax billing code prep page — [`.claude/plans/UI-P2-012.md`](.claude/plans/UI-P2-012.md)

- [x] **FEAT-P2-002**: Implement monthly tax payment reminders (in-app) — [`.claude/plans/FEAT-P2-002.md`](.claude/plans/FEAT-P2-002.md)

### Transfer Between Accounts

- [x] **API-P2-009**: Implement account-to-account transfer API — [`.claude/plans/API-P2-009.md`](.claude/plans/API-P2-009.md)

- [x] **UI-P2-013**: Implement transfer between accounts UI — [`.claude/plans/UI-P2-013.md`](.claude/plans/UI-P2-013.md)

---

## Phase 3: Reports, Export, Offline & Polish

*Correlates to Milestones M6 (Weeks 13-14), M7 (Weeks 13-15), M8 (Weeks 15-16), M9 (Week 16)*

### SAK EMKM Financial Reports (F-010)

- [x] **FEAT-P3-001**: Implement Laporan Laba Rugi (Income Statement) generator — [`.claude/plans/FEAT-P3-001.md`](.claude/plans/FEAT-P3-001.md)

- [x] **FEAT-P3-002**: Implement Laporan Posisi Keuangan (Balance Sheet) generator — [`.claude/plans/FEAT-P3-002.md`](.claude/plans/FEAT-P3-002.md)

- [x] **FEAT-P3-003**: Implement Catatan atas Laporan Keuangan (Notes) generator — [`.claude/plans/FEAT-P3-003.md`](.claude/plans/FEAT-P3-003.md)

- [x] **UI-P3-001**: Implement Reports page (`/laporan`) — [`.claude/plans/UI-P3-001.md`](.claude/plans/UI-P3-001.md)

### Export Functionality (F-013, F-014, F-021)

- [x] **FEAT-P3-004**: Implement Excel/CSV export for transactions — [`.claude/plans/FEAT-P3-004.md`](.claude/plans/FEAT-P3-004.md)

- [x] **FEAT-P3-005**: Implement PDF export for financial reports — [`.claude/plans/FEAT-P3-005.md`](.claude/plans/FEAT-P3-005.md)

- [x] **FEAT-P3-006**: Implement SPT Tahunan (Annual Tax Return) data export — [`.claude/plans/FEAT-P3-006.md`](.claude/plans/FEAT-P3-006.md)

- [x] **UI-P3-002**: Implement export UI controls in transaction list and reports — [`.claude/plans/UI-P3-002.md`](.claude/plans/UI-P3-002.md)

### Tax Billing Code PDF Export

- [x] **FEAT-P3-007**: Implement tax billing code summary PDF export — [`.claude/plans/FEAT-P3-007.md`](.claude/plans/FEAT-P3-007.md)

### Offline-First PWA (F-016)

- [x] **FEAT-P3-008**: Implement Service Worker for PWA asset caching — [`.claude/plans/FEAT-P3-008.md`](.claude/plans/FEAT-P3-008.md)

- [x] **FEAT-P3-009**: Implement IndexedDB local storage for offline data — [`.claude/plans/FEAT-P3-009.md`](.claude/plans/FEAT-P3-009.md)

- [x] **FEAT-P3-010**: Implement offline-to-online sync engine — [`.claude/plans/FEAT-P3-010.md`](.claude/plans/FEAT-P3-010.md)

- [x] **UI-P3-003**: Implement sync status indicator UI — [`.claude/plans/UI-P3-003.md`](.claude/plans/UI-P3-003.md)

### Onboarding (F-018)

- [x] **UI-P3-004**: Implement 3-step onboarding wizard — [`.claude/plans/UI-P3-004.md`](.claude/plans/UI-P3-004.md)

- [x] **FEAT-P3-011**: Implement business profile CRUD — [`.claude/plans/FEAT-P3-011.md`](.claude/plans/FEAT-P3-011.md)

### Transaction Templates (F-019)

- [x] **API-P2-010**: Implement Transaction Templates CRUD API — [`.claude/plans/API-P2-010.md`](.claude/plans/API-P2-010.md)

- [x] **UI-P3-005**: Implement transaction templates in transaction entry form — [`.claude/plans/UI-P3-005.md`](.claude/plans/UI-P3-005.md)

### Backup & Restore (F-020)

- [x] **FEAT-P3-012**: Implement data backup generation — [`.claude/plans/FEAT-P3-012.md`](.claude/plans/FEAT-P3-012.md)

- [x] **FEAT-P3-013**: Implement data restore from backup — [`.claude/plans/FEAT-P3-013.md`](.claude/plans/FEAT-P3-013.md)

- [x] **UI-P3-006**: Implement backup/restore UI in Settings — [`.claude/plans/UI-P3-006.md`](.claude/plans/UI-P3-006.md)

### Settings Page

- [x] **UI-P3-007**: Implement Settings page (`/pengaturan`) — [`.claude/plans/UI-P3-007.md`](.claude/plans/UI-P3-007.md)

### Mobile Responsive Design (F-017)

- [x] **UI-P3-008**: Implement mobile-optimized responsive design across all pages — [`.claude/plans/UI-P3-008.md`](.claude/plans/UI-P3-008.md)

### Bahasa Indonesia Review (F-015)

- [x] **UI-P3-009**: Comprehensive Bahasa Indonesia UI language review — [`.claude/plans/UI-P3-009.md`](.claude/plans/UI-P3-009.md)

### Empty States & UX Polish

- [x] **UI-P3-010**: Implement empty states for all pages — [`.claude/plans/UI-P3-010.md`](.claude/plans/UI-P3-010.md)

- [x] **UI-P3-011**: Implement loading states (skeleton screens) — [`.claude/plans/UI-P3-011.md`](.claude/plans/UI-P3-011.md)

- [x] **UI-P3-012**: Implement confirmation dialogs for destructive actions — [`.claude/plans/UI-P3-012.md`](.claude/plans/UI-P3-012.md)

### Accessibility (WCAG AA)

- [x] **UI-P3-013**: Implement WCAG AA accessibility compliance — [`.claude/plans/UI-P3-013.md`](.claude/plans/UI-P3-013.md)

---

## Phase 4: Testing, Documentation & Launch

*Correlates to Milestone M10 (Weeks 17-20)*

### Testing & Quality Assurance

- [ ] **TEST-P4-001**: Write unit tests for PPh Final tax calculation engine — [`.claude/plans/TEST-P4-001.md`](.claude/plans/TEST-P4-001.md)

- [ ] **TEST-P4-002**: Write unit tests for financial report generators — [`.claude/plans/TEST-P4-002.md`](.claude/plans/TEST-P4-002.md)

- [ ] **TEST-P4-003**: Write integration tests for all API endpoints — [`.claude/plans/TEST-P4-003.md`](.claude/plans/TEST-P4-003.md)

- [ ] **TEST-P4-004**: Write E2E tests for critical user flows — [`.claude/plans/TEST-P4-004.md`](.claude/plans/TEST-P4-004.md)

- [ ] **TEST-P4-005**: Write unit tests for offline sync engine — [`.claude/plans/TEST-P4-005.md`](.claude/plans/TEST-P4-005.md)

- [ ] **TEST-P4-006**: Perform Lighthouse performance audit — [`.claude/plans/TEST-P4-006.md`](.claude/plans/TEST-P4-006.md)

- [ ] **TEST-P4-007**: Cross-browser and device testing — [`.claude/plans/TEST-P4-007.md`](.claude/plans/TEST-P4-007.md)

- [ ] **TEST-P4-008**: Security testing (OWASP top 10) — [`.claude/plans/TEST-P4-008.md`](.claude/plans/TEST-P4-008.md)

### Documentation

- [ ] **DOC-P4-001**: Write in-app help tooltips and FAQ content — [`.claude/plans/DOC-P4-001.md`](.claude/plans/DOC-P4-001.md)

- [ ] **DOC-P4-002**: Write README with setup and deployment instructions — [`.claude/plans/DOC-P4-002.md`](.claude/plans/DOC-P4-002.md)

- [ ] **DOC-P4-003**: Write inline JSDoc for all public functions — [`.claude/plans/DOC-P4-003.md`](.claude/plans/DOC-P4-003.md)

### Deployment & DevOps

- [ ] **DEPLOY-P4-001**: Configure production Cloudflare D1 database — [`.claude/plans/DEPLOY-P4-001.md`](.claude/plans/DEPLOY-P4-001.md)

- [ ] **DEPLOY-P4-002**: Configure production Cloudflare R2 bucket — [`.claude/plans/DEPLOY-P4-002.md`](.claude/plans/DEPLOY-P4-002.md)

- [ ] **DEPLOY-P4-003**: Configure production Cloudflare KV namespace — [`.claude/plans/DEPLOY-P4-003.md`](.claude/plans/DEPLOY-P4-003.md)

- [ ] **DEPLOY-P4-004**: Configure Cloudflare Worker GitHub integration for auto-deploy — [`.claude/plans/DEPLOY-P4-004.md`](.claude/plans/DEPLOY-P4-004.md)

- [ ] **DEPLOY-P4-005**: Configure production environment variables and secrets — [`.claude/plans/DEPLOY-P4-005.md`](.claude/plans/DEPLOY-P4-005.md)

- [ ] **DEPLOY-P4-006**: Verify production deployment and health — [`.claude/plans/DEPLOY-P4-006.md`](.claude/plans/DEPLOY-P4-006.md)

---

## Phase 5: Backlog (Future Phases)

*From PRD Phase 2 (Months 5-8) and Phase 3 (Months 9-12)*

### Phase 2 — Growth Features

- [ ] **INT-P5-001**: Implement Telegram bot for transaction recording via chat (US-022) — [`.claude/plans/INT-P5-001.md`](.claude/plans/INT-P5-001.md)

- [ ] **FEAT-P5-001**: Implement simple inventory tracking (stock in/out) (US-023) — [`.claude/plans/FEAT-P5-001.md`](.claude/plans/FEAT-P5-001.md)

- [ ] **FEAT-P5-002**: Implement AI auto-suggest expense categories (US-024) — [`.claude/plans/FEAT-P5-002.md`](.claude/plans/FEAT-P5-002.md)

- [ ] **FEAT-P5-003**: Implement receipt OCR for auto-fill transaction details (US-025) — [`.claude/plans/FEAT-P5-003.md`](.claude/plans/FEAT-P5-003.md)

- [ ] **FEAT-P5-004**: Implement voice input for transaction recording (US-026) — [`.claude/plans/FEAT-P5-004.md`](.claude/plans/FEAT-P5-004.md)

- [ ] **FEAT-P5-005**: Implement branded invoice generation and WhatsApp sharing (US-027) — [`.claude/plans/FEAT-P5-005.md`](.claude/plans/FEAT-P5-005.md)

- [ ] **FEAT-P5-006**: Implement PPN/VAT awareness alerts at Rp4.8B threshold (US-028) — [`.claude/plans/FEAT-P5-006.md`](.claude/plans/FEAT-P5-006.md)

- [ ] **UI-P5-001**: Implement dark mode (US-029) — [`.claude/plans/UI-P5-001.md`](.claude/plans/UI-P5-001.md)

- [ ] **FEAT-P5-007**: Implement recurring transactions (US-030) — [`.claude/plans/FEAT-P5-007.md`](.claude/plans/FEAT-P5-007.md)

### Phase 3 — Scale Features

- [ ] **FEAT-P5-008**: Implement multi-branch consolidated reporting (US-031) — [`.claude/plans/FEAT-P5-008.md`](.claude/plans/FEAT-P5-008.md)

- [ ] **FEAT-P5-009**: Implement accountant read-only access (US-032) — [`.claude/plans/FEAT-P5-009.md`](.claude/plans/FEAT-P5-009.md)

- [ ] **FEAT-P5-010**: Implement PPh Final transition guidance (US-033) — [`.claude/plans/FEAT-P5-010.md`](.claude/plans/FEAT-P5-010.md)

- [ ] **INT-P5-002**: Implement WhatsApp payment reminders to customers (US-034) — [`.claude/plans/INT-P5-002.md`](.claude/plans/INT-P5-002.md)

- [ ] **FEAT-P5-011**: Implement tax guidance chatbot in Bahasa Indonesia (US-035) — [`.claude/plans/FEAT-P5-011.md`](.claude/plans/FEAT-P5-011.md)

- [ ] **INT-P5-003**: Implement bank account auto-import (read-only) (US-036) — [`.claude/plans/INT-P5-003.md`](.claude/plans/INT-P5-003.md)

- [ ] **FEAT-P5-012**: Implement basic payroll tracking for 1-10 employees (US-037) — [`.claude/plans/FEAT-P5-012.md`](.claude/plans/FEAT-P5-012.md)

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
