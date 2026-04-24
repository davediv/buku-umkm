# DEPLOY-P4-004: Configure Cloudflare Worker GitHub integration for auto-deploy

- **Success Criteria**:
  - GitHub repo connected to Cloudflare Workers via dashboard
  - Push to `main` triggers auto-build and deploy
  - No GitHub Actions workflow needed (Cloudflare native integration)
  - Environment variables (BETTER_AUTH_SECRET, ORIGIN) set in Cloudflare dashboard
  - Build command: `npm run build`
  - Deploy verified: app accessible at production URL
- **Dependencies**: DEPLOY-P4-001, DEPLOY-P4-002, DEPLOY-P4-003
