# DEPLOY-P4-005: Configure production environment variables and secrets

- **Success Criteria**:
  - `BETTER_AUTH_SECRET` set as encrypted secret in Cloudflare
  - `ORIGIN` set to production URL
  - No secrets hardcoded in codebase or committed to git
  - `.dev.vars` in `.gitignore`
- **Dependencies**: DEPLOY-P4-004
