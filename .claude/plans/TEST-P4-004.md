# TEST-P4-004: Write E2E tests for critical user flows

- **Success Criteria**:
  - E2E tests using Playwright for:
    - Registration -> Onboarding -> First transaction flow
    - Daily transaction recording (income and expense)
    - Debt creation and payment recording
    - Tax calculation and billing code view
    - Report generation and PDF export
    - Backup and restore
  - All tests pass on Chrome Android viewport
- **Browser Validation** (chrome-devtools MCP):
  - Execute E2E scenarios manually via browser to verify tests cover correct flows
  - Verify all critical paths complete without console errors
- **Dependencies**: All UI tasks
