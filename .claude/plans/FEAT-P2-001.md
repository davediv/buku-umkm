# FEAT-P2-001: Implement PPh Final 0.5% tax calculation engine

- **Success Criteria**:
  - Tax engine module at `src/lib/server/tax/` or `src/lib/tax/`
  - Calculates monthly PPh Final = 0.5% x gross monthly revenue
  - For WP OP: tracks cumulative annual revenue against Rp500M threshold
  - When cumulative <= Rp500M: tax = 0
  - When cumulative > Rp500M: tax = 0.5% x monthly revenue (for months after threshold exceeded)
  - Mid-month threshold crossing: only revenue above threshold is taxed for that month
  - For WP Badan: tax = 0.5% x monthly revenue from month 1 (no threshold)
  - Tax year resets on January 1
  - Revenue = gross total pemasukan (not net profit)
  - Tax rates and thresholds stored as configuration (not hardcoded)
  - Comprehensive unit tests with edge cases (threshold crossing, year boundary, zero revenue months)
- **Dependencies**: DB-P1-004
