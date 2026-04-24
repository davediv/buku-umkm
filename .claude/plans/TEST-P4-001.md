# TEST-P4-001: Write unit tests for PPh Final tax calculation engine

- **Success Criteria**:
  - Test cases cover:
    - Monthly revenue below Rp500M threshold (WP OP) — tax = 0
    - Monthly revenue after threshold exceeded — tax = 0.5% x monthly revenue
    - Mid-month threshold crossing — only above-threshold portion taxed
    - WP Badan (no threshold) — tax from month 1
    - Year boundary reset
    - Zero revenue month
    - Maximum amount edge cases
  - All tests pass with 100% branch coverage on tax engine
- **Dependencies**: FEAT-P2-001
