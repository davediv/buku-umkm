# DEPLOY-P4-001: Configure production Cloudflare D1 database

- **Success Criteria**:
  - Production D1 database created in Cloudflare dashboard
  - `database_id` in `wrangler.jsonc` updated with production ID
  - `npm run db:migrate:remote` applies migrations to production D1
  - All tables verified in production
- **Dependencies**: DB-P1-002
