# DEPLOY-P4-006: Verify production deployment and health

- **Success Criteria**:
  - App loads at production URL within 3 seconds
  - HTTPS/TLS enforced (Cloudflare default)
  - Auth flow works (register, login, logout)
  - Transaction creation works
  - PWA installable from production URL
  - No console errors
- **Browser Validation** (chrome-devtools MCP):
  - Navigate to production URL and verify app loads
  - Check Security tab for valid SSL
  - Complete registration and login flow
  - Create a test transaction and verify it persists
  - Verify PWA install prompt on mobile viewport
  - Check Console for no errors
- **Dependencies**: DEPLOY-P4-004
