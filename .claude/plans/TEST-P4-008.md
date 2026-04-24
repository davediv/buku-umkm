# TEST-P4-008: Security testing (OWASP top 10)

- **Success Criteria**:
  - No XSS vulnerabilities (all user input sanitized)
  - No SQL injection (Drizzle ORM parameterized queries)
  - CSRF protection via SvelteKit built-in
  - Auth endpoints rate-limited
  - NPWP data encrypted at rest
  - No sensitive data in client-side logs or console
  - CSP headers configured
- **Dependencies**: All feature tasks
