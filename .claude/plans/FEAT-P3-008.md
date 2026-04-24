# FEAT-P3-008: Implement Service Worker for PWA asset caching

- **Success Criteria**:
  - Service Worker registered in app entry point
  - All static assets (JS, CSS, images, fonts) cached on first visit
  - App shell loads fully from cache when offline
  - Versioned cache keys for proper invalidation on deploy
  - Forced update mechanism when new version available
  - PWA manifest (`manifest.json`) with app name, icons, theme color, display: standalone
  - App installable as PWA on Android Chrome and iOS Safari
- **Browser Validation** (chrome-devtools MCP):
  - Open Application tab and verify Service Worker registered
  - Verify manifest.json parsed correctly with app details
  - Check Cache Storage for cached static assets
  - Go offline (Network tab -> Offline) and verify app shell loads
  - Verify "Install" prompt appears on Android Chrome
- **Dependencies**: None
