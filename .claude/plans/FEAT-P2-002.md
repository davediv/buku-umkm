# FEAT-P2-002: Implement monthly tax payment reminders (in-app)

- **Success Criteria**:
  - In-app notification/banner appears starting 1st of the month for previous month's tax
  - Visual prominence increases as 15th approaches (color change, larger banner)
  - Reminder includes: tax period, amount due, link to billing code prep page
  - Reminder dismissed after user marks tax as "Sudah Dibayar"
  - Reminder logic: only show if cumulative revenue > Rp500M (for WP OP) or always (for WP Badan)
- **Dependencies**: FEAT-P2-001, UI-P2-011
