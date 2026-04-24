# FEAT-P3-011: Implement business profile CRUD

- **Success Criteria**:
  - `GET /api/profile` returns business profile for authenticated user
  - `PUT /api/profile` updates business profile (name, type, address, npwp, logo)
  - Profile created during onboarding wizard
  - NPWP format validation (15 or 16 digits)
  - NPWP stored encrypted at application level (PII protection)
  - Profile data used for report generation headers
- **Dependencies**: DB-P1-002, AUTH-P1-004
