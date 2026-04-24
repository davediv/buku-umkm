# AUTH-P1-003: Implement user login API with session management

- **Success Criteria**:
  - POST to Better Auth login endpoint with valid credentials returns session
  - Invalid credentials return 401 with Bahasa Indonesia error message
  - Session cookie set with secure flags (HttpOnly, Secure, SameSite)
  - `event.locals.user` and `event.locals.session` populated in hooks
- **Dependencies**: AUTH-P1-001, DB-P1-002
