# INFRA-P1-008: Configure rate limiting via Cloudflare WAF rules

- **Success Criteria**:
  - Rate limiting rules defined for API endpoints (auth, data mutations)
  - Auth endpoints limited to 5 requests/minute per IP
  - Data API endpoints limited to 60 requests/minute per user
- **Dependencies**: None
