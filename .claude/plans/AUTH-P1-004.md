# AUTH-P1-004: Implement auth guards for protected routes

- **Success Criteria**:
  - Unauthenticated requests to protected pages redirect to `/masuk` (login)
  - API routes return 401 for unauthenticated requests
  - Auth guard logic in `hooks.server.ts` or layout server load
  - Public routes (`/`, `/masuk`, `/daftar`) accessible without auth
- **Dependencies**: AUTH-P1-003
