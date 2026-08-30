# UX, Navigation, and Product Architecture Review

**Audit date:** 2026-08-30  
**Scope:** All product routes, shared navigation, onboarding, transaction entry and browsing, financial accounts, debt tracking, reports, tax workflows, settings, public/authentication pages, offline behavior, and the supporting server/API boundaries.

## Implementation checklist

- [x] **UX-ARCH-01:** Make onboarding server-authoritative and idempotent.
- [x] **UX-ARCH-02:** Adopt and communicate one honest offline architecture.
- [x] **UX-ARCH-03:** Introduce a single, typed financial mutation layer.
- [ ] **UX-ARCH-04:** Make dated financial reports historically accurate.
- [ ] **UX-ARCH-05:** Rebuild tax as a current, versioned eligibility system.
- [ ] **UX-ARCH-06:** Reduce and group primary navigation.
- [ ] **UX-ARCH-07:** Replace the current `Lainnya` and Settings dead-end structure.
- [ ] **UX-ARCH-08:** Consolidate reports into one canonical route hierarchy.
- [ ] **UX-ARCH-09:** Rebuild transaction browsing around a server query contract.
- [ ] **UX-ARCH-10:** Preserve transaction-entry context and partial outcomes.
- [ ] **UX-ARCH-11:** Correct the Utang/Piutang journey.
- [ ] **UX-ARCH-12:** Never conflate error, empty, offline, and success states.
- [ ] **UX-ARCH-13:** Standardize navigation continuity and URL state.
- [ ] **UX-ARCH-14:** Adopt accessible interaction primitives and responsive data patterns.

A recommendation is checked only after its implementation, regression coverage, relevant validation commands, and documentation update are committed together.

## Executive assessment

A major redesign is justified, but visual polish should not be the first phase. The highest-risk problems are mismatches between what the interface promises and what the underlying system actually saves, retrieves, calculates, or reports.

The strongest foundations to preserve are the task-focused dashboard, prominent transaction capture action, Indonesian-first copy, protected application routes, and generally helpful empty states.

## Recommendations

### UX-ARCH-01 — Make onboarding server-authoritative and idempotent

**Priority:** Critical

**Issue:** Onboarding creates the business profile and first financial account in IndexedDB and records completion in `localStorage`, while the rest of the application reads server data. The sync runtime is not reliably initialized, and business settings can only update an existing server profile.

**Why it is a problem:** A user can successfully finish setup and arrive at an empty dashboard. They may be unable to repair their business profile, and reopening onboarding can create duplicate local records.

**Recommended approach:** Complete onboarding in one idempotent server-side operation that creates the profile, first account, default categories, and durable completion state. Gate onboarding and protected app entry using server state.

**Expected benefit:** A deterministic first-run experience, correct cross-device behavior, and one source of truth.

**Completion criteria:**

- Onboarding provisions canonical server records atomically.
- Repeating the request cannot duplicate setup data.
- Completed users are redirected away from onboarding.
- Skipping onboarding has durable, explicit semantics.
- Registration-to-dashboard behavior has regression tests.

### UX-ARCH-02 — Adopt and communicate one honest offline architecture

**Priority:** Critical

**Issue:** Public copy promises full offline use and automatic synchronization, but authenticated navigation requires the network, most CRUD operations call server routes directly, and only a small subset of data uses IndexedDB.

**Why it is a problem:** Users may believe financial records are safely stored offline when core workflows cannot operate. This creates direct data-trust risk.

**Recommended approach:** Adopt an explicit online-first model in the near term: server-authoritative records, a cached application shell, locally preserved drafts, and clearly labeled pending behavior only where supported. Remove the parallel unused local-first implementation or complete it before restoring the claim.

**Expected benefit:** Predictable behavior during poor connectivity and accurate user expectations.

**Completion criteria:**

- Product copy accurately describes current offline capability.
- The application exposes online, offline, and stale-data state clearly.
- Unsupported synchronization controls and unused local-first paths are removed.
- Supported drafts survive navigation/reload without claiming they are saved records.

### UX-ARCH-03 — Introduce a single, typed financial mutation layer

**Priority:** Critical

**Issue:** Several write paths generate conflicting identifiers, return different shapes for create versus update, or expose fields that are not persisted. Debt creation can insert a record and then report failure because the API tries to read a different ID.

**Why it is a problem:** This can produce duplicate debts, phantom optimistic records, stale screens, and financial changes that appear saved but are not.

**Recommended approach:** Add domain commands that own ID generation, validation, authorization, balance effects, transactionality, and canonical returned entities. Use shared request/response schemas and idempotency where retries can duplicate money records.

**Expected benefit:** Correct balances and identities, trustworthy success feedback, and simpler UI code.

**Completion criteria:**

- Identifiers are generated exactly once for every create operation.
- Create and update mutations return canonical persisted entities.
- Transaction type/account controls are either supported correctly or non-editable.
- Financial side effects are transactional.
- Regression tests cover create, update, retry, and ownership behavior.

### UX-ARCH-04 — Make dated financial reports historically accurate

**Priority:** Critical

**Issue:** The Posisi Keuangan date selector changes the report label, but calculations use current account balances and currently active debts. Equity is derived as the balancing difference, making the balanced result true by construction.

**Why it is a problem:** Users can export a report labeled for an earlier date that actually contains current figures.

**Recommended approach:** Derive dated reports from immutable, dated financial movements and debt/payment events up to the requested date. Until historical reporting is supported, expose only an explicitly current snapshot.

**Expected benefit:** Reports mean what their labels say and can be reconciled or audited.

**Completion criteria:**

- Account balances can be calculated as of a selected date.
- Debt and receivable balances respect creation and payment dates.
- Report reconciliation does not manufacture equity solely as a balancing plug.
- Historical calculation tests cover opening balances, transactions, and payments.

### UX-ARCH-05 — Rebuild tax as a current, versioned eligibility system

**Priority:** Critical

**Issue:** Tax logic references superseded rules, reduces eligibility to a personal/body switch, silently defaults missing taxpayer information, mislabels the Rp500 million facility as PTKP, contains a Rp500 billion threshold typo, and presents billing preparation fields as a billing code.

**Why it is a problem:** Users could apply an ineligible regime, calculate the wrong amount, or mistake an estimate for an official tax instrument.

**Recommended approach:** Model legal form, registration/transition date, regime choice, eligibility, aggregated turnover, and tax year. Version rules with legal sources and effective dates. Label calculations as estimates and link billing/filing guidance to official systems.

**Expected benefit:** Safer compliance guidance and maintainable rule updates.

**Current legal reference:** [PP 20/2026, amendment to PP 55/2022](https://www.pajak.go.id/id/peraturan/perubahan-atas-peraturan-pemerintah-nomor-55-tahun-2022-tentang-penyesuaian-pengaturan-0).

**Completion criteria:**

- Tax profiles capture every field required for an eligibility decision.
- Rules are versioned and selected by effective tax year.
- Unsupported/ineligible profiles do not receive a definitive liability calculation.
- Thresholds, taxpayer labels, and billing terminology are correct.
- Unit tests cover eligible, ineligible, transition, threshold-crossing, and body-form cases.

### UX-ARCH-06 — Reduce and group primary navigation

**Priority:** High

**Issue:** Seven destinations are placed in the mobile bottom bar and repeated in an 80px desktop icon rail. Frequent tasks compete with occasional administration, labels are compressed, and `Akun` ambiguously means financial accounts and user identity.

**Why it is a problem:** The hierarchy is difficult to scan and can overflow or crowd narrow mobile viewports.

**Recommended approach:** Use four mobile destinations plus the primary `Catat` action. Use an expanded, grouped desktop sidebar. Rename financial accounts to `Kas & Rekening` and move secondary administration out of primary navigation.

**Expected benefit:** Faster recognition, larger targets, and clearer task hierarchy.

**Completion criteria:**

- Mobile navigation contains at most five slots including the primary action.
- Desktop navigation groups bookkeeping, reporting, and administration.
- Active states work for child routes.
- Labels are unambiguous and fit supported viewports.

### UX-ARCH-07 — Replace `Lainnya` and Settings dead ends

**Priority:** High

**Issue:** Business settings link back to onboarding, Help/About/Privacy use dead anchors, and the real settings sections are non-addressable local tabs. Unavailable controls are presented as coming soon.

**Why it is a problem:** Users encounter dead ends, can accidentally repeat setup, and cannot deep-link to a setting.

**Recommended approach:** Create one structured secondary menu with real destinations for Business & Tax Profile, Account & Security, Data & Backup, Help, Privacy, and About. Hide unavailable features until actionable.

**Expected benefit:** Safe profile management, reliable history/deep links, and stronger credibility.

**Completion criteria:**

- Every visible menu item leads to real content.
- Settings sections are URL-addressable.
- Business settings never reopen onboarding.
- Placeholder controls and duplicate About destinations are removed.

### UX-ARCH-08 — Consolidate reports into canonical routes

**Priority:** High

**Issue:** `/laporan` contains all reports in one large component while separate routes duplicate Laba/Rugi, Posisi Keuangan, and Catatan. Entry points, back behavior, styling, calculation paths, and export capabilities differ.

**Why it is a problem:** Duplicate implementations will continue to diverge and are difficult to validate consistently.

**Recommended approach:** Use a shared report layout with canonical child routes for Laba/Rugi, Posisi Keuangan, Catatan, and SPT Tahunan. Share period controls, error states, headers, and export capability declarations.

**Expected benefit:** One calculation path per report, consistent navigation, and smaller modules.

**Completion criteria:**

- Every report has one canonical URL and implementation.
- Old URLs redirect without losing valid period/date parameters.
- Shared report navigation and controls are accessible.
- Unavailable exports are not presented as available actions.

### UX-ARCH-09 — Rebuild transaction browsing around a server query contract

**Priority:** High

**Issue:** The page loads a capped subset and then searches, sorts, filters, and paginates only that subset. The date control changes its label but does not filter records. Export requests more rows than the API permits.

**Why it is a problem:** Search can falsely report no result, older records can become inaccessible, and pagination implies a complete dataset.

**Recommended approach:** Make validated URL parameters the source of truth for query, type, date range, sort, page, and page size. Filter and paginate on the server and return a total count. Use a dedicated export path.

**Expected benefit:** Correct results at any dataset size, shareable views, and reliable exports.

**Completion criteria:**

- Search, type, date, sort, and pagination operate on the full dataset.
- Applied state is reflected in the URL.
- Total counts and page boundaries are accurate.
- Export uses the same filters without the list endpoint cap.
- Query and pagination behavior has tests.

### UX-ARCH-10 — Preserve transaction-entry context and partial outcomes

**Priority:** High

**Issue:** Add and edit forms have drifted. Leaving the form to create an account, category, or template discards the current entry. Receipt failures are logged but followed by the normal success flow.

**Why it is a problem:** Users lose work and attachments can disappear without explanation.

**Recommended approach:** Use one shared transaction form, preserve local drafts, support safe return navigation when creating dependencies, and expose partial success with attachment retry.

**Expected benefit:** Faster repeat entry, fewer abandoned transactions, and truthful attachment status.

**Completion criteria:**

- Add/edit share field definitions and validation.
- Drafts survive dependency creation and accidental navigation.
- Receipt upload failures are visible and retryable.
- Successful transaction creation is not rolled back by an attachment-only failure.

### UX-ARCH-11 — Correct the Utang/Piutang journey

**Priority:** High

**Issue:** A dashboard type link causes the server to load only that type and calculate both totals from the filtered result, while the client still renders both tabs. The other type therefore appears empty. Dense tables require horizontal panning on mobile.

**Why it is a problem:** Existing obligations can look missing, and overdue items are difficult to scan.

**Recommended approach:** Fetch global totals independently from the active collection. Put tab, status, overdue, search, and sort state in the URL. Use a mobile card view emphasizing contact, balance, due date, status, and next action.

**Expected benefit:** Accurate totals, safer collection/payment decisions, and better mobile usability.

**Completion criteria:**

- Both totals remain accurate regardless of active tab.
- Tab and filters are URL-addressable.
- Overdue and due-soon items are identifiable and sortable.
- Mobile presentation does not require horizontal table scrolling.

### UX-ARCH-12 — Distinguish error, empty, offline, and success states

**Priority:** High

**Issue:** Several loaders convert server failures into empty arrays, and their pages display normal empty states. Success handling also varies between query strings, action data, and optimistic state.

**Why it is a problem:** An outage can look like data loss and prompt users to create duplicate records.

**Recommended approach:** Standardize loading, ready, empty, offline-stale, partial-success, unauthorized, and error states. Include retry, last-updated context, and canonical mutation outcomes.

**Expected benefit:** Users understand what happened and can recover safely.

**Completion criteria:**

- Core collection pages never render an error as an empty state.
- Retry and recovery actions are consistent.
- Create/update/delete/partial-success messages are canonical.
- Error and status announcements are accessible.

### UX-ARCH-13 — Standardize navigation continuity and URL state

**Priority:** High

**Issue:** Authentication redirects do not reliably preserve the requested destination. Meaningful view state can disagree with the URL, and hard-coded back links discard filters and list position.

**Why it is a problem:** Authentication and drill-down workflows unexpectedly reset user context; browser Back and shared links are unreliable.

**Recommended approach:** Use an allow-listed `returnTo`, derive meaningful view state from validated URL parameters, preserve list query/scroll state when opening details, and adopt shared page-header/back conventions.

**Expected benefit:** Predictable navigation, recoverable authentication, and reliable deep linking.

**Completion criteria:**

- Login returns users to safe originally requested routes.
- Dashboard/report/settings/debt state is initialized from the URL.
- Detail-to-list navigation restores the relevant query state.
- Unsafe external redirect targets are rejected.

### UX-ARCH-14 — Adopt accessible interaction primitives and responsive data patterns

**Priority:** High

**Issue:** Dialogs lack complete focus management, tabs lack tab semantics and keyboard behavior, some links contain nested buttons, and several core mobile screens rely on wide tables.

**Why it is a problem:** Keyboard and assistive-technology users can become trapped or lose focus, while touch users must pan through financial data.

**Recommended approach:** Use one audited dialog/sheet primitive with focus trapping and restoration; semantic tabs; link-styled anchors; status announcements; a skip link; and responsive cards for dense mobile data.

**Expected benefit:** Safer operation for every input method and a coherent interaction system.

**Completion criteria:**

- Dialog focus is trapped, initialized, and restored.
- Tabs implement the expected roles and keyboard controls.
- No nested interactive elements remain.
- Core data screens have purposeful mobile layouts.
- Automated accessibility-oriented component tests cover shared primitives.

## Top five priorities

1. Server-authoritative onboarding.
2. Correct, typed financial mutations.
3. Current and versioned tax eligibility.
4. Historically accurate financial reports.
5. An honest offline contract.

## Quick wins

- Qualify unsupported offline, automatic tax, billing-code, and standards-compliance claims.
- Point business settings to the real profile destination and remove dead anchors.
- Disable any financial field that is not persisted.
- Hide unavailable export and account-security actions.
- Surface load errors instead of substituting empty states.
- Normalize create/update/delete outcome messages.
- Reduce mobile navigation density.
- Remove nested anchor/button interactions and add missing page metadata.

## Larger architectural improvements

- A domain/application layer for financial commands and queries.
- A deliberate server-authoritative or fully local-first data model, not both in parallel.
- An immutable ledger for date-correct reports and reconciliation.
- A versioned tax-rule module with explicit legal sources and effective dates.
- Shared report, form, navigation, dialog, and async-state primitives.
- End-to-end coverage for registration, onboarding, transaction entry, debt payment, reports, and tax guidance.

## Risks if the current structure is retained

- Setup can appear successful while canonical profile/account data is absent.
- Retried mutations can duplicate financial records.
- Financial fields can look changed without being persisted.
- Historical reports can contain current figures.
- Tax estimates can be calculated under an inapplicable rule.
- Older transactions can be hidden by client-only filtering.
- Server outages can look like deleted data.
- Users can rely on offline behavior that is not supported.
- Dead links and unfinished controls can materially reduce trust.
- Duplicate report and form implementations will continue to diverge.

## Recommended ideal information architecture

```text
Public
├── Product overview
├── Data storage and synchronization
├── Security and privacy
├── Help and documentation
├── Sign in
└── Register

Application
├── Beranda
├── Pembukuan
│   ├── Transaksi
│   ├── Kas & Rekening
│   └── Utang & Piutang
├── Laporan
│   ├── Laba/Rugi
│   ├── Posisi Keuangan
│   ├── Catatan Laporan
│   └── SPT Tahunan — draft/estimate
├── Pajak
│   ├── Eligibility and tax profile
│   ├── Monthly obligations
│   ├── Payment history/evidence
│   └── Official filing and billing guidance
├── Kelola
│   ├── Kategori
│   └── Template Transaksi
├── Pengaturan
│   ├── Profil Bisnis & Pajak
│   ├── Akun & Keamanan
│   └── Data & Cadangan
└── Help / Privacy / About
```

Recommended mobile navigation starting point:

`Beranda · Transaksi · + Catat · Laporan · Menu`

The secondary menu should surface Pajak with an obligation badge, Utang & Piutang, Kas & Rekening, Kelola, and Pengaturan. Desktop should expose the grouped hierarchy in an expanded sidebar.
