# INFRA-P1-005: Configure Cloudflare KV binding for session/cache

- **Success Criteria**:
  - KV namespace binding added to `wrangler.jsonc` with binding name `KV`
  - `worker-configuration.d.ts` regenerated with `npm run cf-typegen`
  - KV namespace accessible in server-side code via `platform.env.KV`
- **Dependencies**: None
