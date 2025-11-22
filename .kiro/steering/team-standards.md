
# Team Standards (Mobius1v3)
- Language: TypeScript (Node 20); consider Go for high-perf services
- Framework: Fastify (or NestJS if needed)
- DB: PostgreSQL via Prisma (preferred) or Knex
- Testing: Vitest/Jest, coverage ≥ 80%
- Lint/Format: ESLint + Prettier; commit must pass
- Security: no inline secrets; .env only; secret scanning required
- Privacy: redact PII in logs; Spain-only residency mode must be testable
- Docs: JSDoc for public symbols; ADRs for key decisions in `docs/adrs/`
- Git: Conventional Commits; small PRs; trunk-based with feature flags
