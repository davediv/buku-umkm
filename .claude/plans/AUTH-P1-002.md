# AUTH-P1-002: Implement user registration API with email/password

- **Success Criteria**:
  - POST to Better Auth signup endpoint creates a new user
  - Password hashed with bcrypt/argon2 (minimum 8 characters enforced)
  - Duplicate email returns appropriate error
  - New user record created in D1 database
- **Dependencies**: AUTH-P1-001, DB-P1-002
