# INFRA-P1-004: Configure Cloudflare R2 binding for receipt photo storage

- **Success Criteria**:
  - R2 bucket binding added to `wrangler.jsonc` with binding name `R2`
  - `worker-configuration.d.ts` regenerated with `npm run cf-typegen`
  - R2 bucket accessible in server-side code via `platform.env.R2`
- **Dependencies**: None
