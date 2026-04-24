# FEAT-P3-010: Implement offline-to-online sync engine

- **Success Criteria**:
  - Sync occurs automatically when connectivity returns
  - Pending changes tracked with sync status (pending/synced/error)
  - Visual sync status indicator in app header or settings
  - Conflict resolution: last-write-wins with user notification for conflicts
  - Sync of 100 transactions completes in < 10 seconds
  - Offline data is source of truth until sync confirmed
  - Cloud data does not overwrite unsynced local changes
  - Sync error recovery: retry with exponential backoff
- **Dependencies**: FEAT-P3-009, API-P2-003
