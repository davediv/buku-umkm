# TEST-P4-005: Write unit tests for offline sync engine

- **Success Criteria**:
  - Tests cover: local save, sync on reconnect, conflict resolution (last-write-wins), error recovery
  - Test offline transaction creation and sync
  - Test sync of 100 transactions completes in < 10 seconds
  - All tests pass
- **Dependencies**: FEAT-P3-010
