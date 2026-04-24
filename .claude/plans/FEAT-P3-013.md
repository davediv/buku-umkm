# FEAT-P3-013: Implement data restore from backup

- **Success Criteria**:
  - `POST /api/restore` accepts backup file and overwrites local data
  - Schema version validation before applying restore
  - Confirmation dialog with clear warning about data overwrite
  - Restore validates data integrity before applying
  - Forward-compatible: newer app version can restore older backup
- **Dependencies**: FEAT-P3-012
