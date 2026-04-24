# TEST-P4-006: Perform Lighthouse performance audit

- **Success Criteria**:
  - Lighthouse Performance score >= 85 on mobile throttling (simulating Rp1.5M Android device)
  - Initial page load < 3 seconds on simulated 3G
  - JS bundle size (gzipped) < 150KB initial
  - All Core Web Vitals pass
  - Accessibility score >= 90
- **Browser Validation** (chrome-devtools MCP):
  - Run Lighthouse audit on `/beranda` with mobile preset
  - Verify Performance >= 85
  - Verify Accessibility >= 90
  - Verify bundle size in Network tab
  - Run Lighthouse on `/masuk` and `/transaksi`
- **Dependencies**: All feature tasks
