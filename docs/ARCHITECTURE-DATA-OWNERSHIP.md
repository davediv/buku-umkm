# Data Ownership and Connectivity Contract

**Decision date:** 2026-08-30

**Status:** Accepted

Buku UMKM is an online-first, server-authoritative application. Cloudflare D1 is the source of truth for business and financial records. A financial change is saved only after the server confirms it; the interface must never represent a local draft or failed request as a booked record.

## Supported behavior

- The service worker caches public application assets and provides an offline fallback page. It does not cache authenticated HTML, API responses, or user financial data.
- The application always shows whether it is online, offline with potentially stale displayed data, refreshing after reconnection, or unable to refresh.
- The add-transaction form preserves text fields in local storage. A draft is device-local, is not synchronized, is not a financial record, and is cleared after the server confirms creation.
- Receipt files are not placed in local storage and must be selected again if the user leaves the form.
- All canonical reads and writes require a network connection.

## Explicitly unsupported

- Creating, editing, or deleting canonical records while offline.
- A pending mutation queue or background synchronization.
- Multi-device conflict resolution for unsaved local changes.
- Claims that authenticated business data remains fully usable without internet.

Restoring full offline mutation support later requires a designed outbox, idempotency keys, ordered financial side effects, conflict policy, ownership validation, encryption/storage limits, and end-to-end failure testing. It must not be reintroduced as a parallel IndexedDB CRUD layer.
