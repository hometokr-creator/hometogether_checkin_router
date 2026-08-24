# Home Together v0 implementation plan

## Current implementation status (2026-08-23)

- [x] Next.js 16 + React 19 + TypeScript project conversion
- [x] Operator console migrated to an App Router client component
- [x] Classification schema validation with Zod
- [x] Deterministic A/B/C routing module
- [x] Kakao inbound Route Handler skeleton
- [x] HH-002 routing tests
- [x] v1.1 Kakao reachability and Event API eligibility policy
- [x] Alimtalk/phone fallback planning
- [x] Linked/unlinked/conflict inbound access policy
- [x] Sequential native quickReplies check-in message builder
- [x] Prisma 7 PostgreSQL schema validated and client generated
- [x] Hashed, expiring, single-use channel linking token service
- [x] Transactional Prisma identity-link repository
- [x] Authenticated channel-link token issuance Route Handler
- [x] Public single-use channel-link verification Route Handler
- [x] lint, typecheck, unit tests, and production build
- [ ] Apply initial migration to a real PostgreSQL database (DATABASE_URL required)
- [ ] Virtual-data seed (blocked by missing virtual data bundle)
- [ ] Authentication and household-scoped persistence
- [ ] Real Kakao and LLM providers

## Repository audit

- Framework/language: framework-free HTML, CSS, and browser JavaScript
- Package manager: none
- Database/ORM: none
- Authentication/authorization: none
- Kakao integration: none
- Admin UI: an unrelated static Signal Desk prototype existed and will be replaced
- Migrations: none
- Virtual data: required `홈투게더_프로토타입_가상데이터/` files are missing
- APIs: none
- Test environment: none
- Deployment: static files only; no deployment configuration
- Missing configuration: all feature flags, Kakao credentials/callback settings, persistence, auth, LLM provider, retention policy

## v0 slice implemented in this repository

1. Replace the unrelated prototype with an operator console.
2. Reproduce only the HH-002 noise scenario explicitly supplied by the spec.
3. Provide deterministic classification, ledger comparison, and route B decision in browser code.
4. Require an operator click before any customer-facing draft is marked approved.
5. Keep all auto-send/auto-activation/partner-dispatch flags off.
6. Surface evidence, reason codes, SLA, event timeline, and audit entries.
7. Clearly mark unavailable views that depend on the missing virtual data bundle.

## Deferred until source data/backend are supplied

- Database schema, migrations, seed loader, and FK validation
- Real household/member/contract identity and role-based access
- Kakao inbound/outbound webhooks and idempotency persistence
- LLM gateway and schema validation
- Full question bank/check-in compose workflow
- A-route RAG and C-route partner consent workflow
- Real audit retention, encryption, and PII masking
- Automated unit/integration/security test suite

## Production transition: Kakao member linking

The current operator panel uses explicit `memberId` and `contractCycleId` fields
with demo identifiers so the v0 linking flow can be tested end to end. This is
not the intended production UX.

Before real-member operation:

- Add authenticated operator access; do not ask operators to paste `INTERNAL_API_KEY`.
- Search members by an approved operational identifier and select a result instead
  of typing internal database IDs.
- Resolve the member's active `contractCycleId` on the server and reject ambiguous,
  ended, or cross-household matches.
- Keep `memberId` and `contractCycleId` as durable internal identifiers.
- Keep only the Kakao linking code short-lived (currently 15 minutes) and single-use.
- After first verification, identify future messages by the stored hashed Kakao user
  key so the member does not enter a member ID or linking code again.
- Add operator authorization, member-search audit logs, rate limits, and code-revocation
  controls before enabling the flow for real customer data.

## Safety defaults

- `CHECKIN_AUTO_SEND=false`
- `INBOUND_AUTO_REPLY=false`
- `QUESTION_AUTO_ACTIVATE=false`
- `FAQ_AUTO_ACTIVATE=false`
- `PARTNER_AUTO_DISPATCH=false`
- `DIRECT_DEAL_AUTO_ACTION=false`
- `HUMAN_REVIEW_REQUIRED=true`
