# Instagram Module

This module implements the repository's Instagram integration using **Instagram API with Instagram Login**.

## Read This First

If you are editing this module, read files in this order:

1. `instagram.constants.ts`
2. `queues/instagram-fetch.queue.ts`
3. `instagram.controller.ts`
4. `instagram.service.ts`
5. `providers/instagram-official.provider.ts`
6. `instagram-rate-limit.service.ts`
7. `types/instagram-api.types.ts`
8. `../../../../docs/agent-system/adr-005-instagram-api-with-instagram-login.md`
9. `../../../../docs/agent-system/instagram-source-evaluation.md`

## Responsibilities

- `instagram.controller.ts`
  Owns public HTTP routes only.
- `instagram.service.ts`
  Owns orchestration, token encryption/decryption, persistence, and queue enqueueing.
- `providers/instagram-official.provider.ts`
  Owns OAuth URLs, scopes, Instagram endpoints, retry logic, and raw HTTP calls.
- `queues/instagram-fetch.queue.ts`
  Defines the internal queue contract.
- `queues/instagram-fetch.processor.ts`
  Executes queue jobs and wraps work in provider/user-specific exclusivity.
- `instagram-rate-limit.service.ts`
  Owns Redis-backed rate limiting and worker serialization.
- `types/instagram-api.types.ts`
  Owns provider-facing response contracts.

## Request Flow

1. `GET /api/v1/auth/instagram` redirects to Instagram OAuth.
2. Callback stores encrypted long-lived token metadata in `InstagramToken`.
3. `POST /api/v1/influencer-profiles/:profileId/fetch` enqueues a `PROFILE` job.
4. Queue processor calls `InstagramService.processProfileFetch()`.
5. Service resolves access token, calls provider, saves snapshot, then enqueues `MEDIA_INSIGHTS`.
6. `MEDIA_INSIGHTS` runs only with explicit `subjectType` and `targetAccountId`.

## Non-Negotiable Invariants

- Public routes must stay stable.
- `InstagramOfficialProvider` owns all Instagram HTTP/OAuth details.
- `InstagramService` must not contain raw endpoint URLs, scope literals, or direct HTTP calls.
- `connected account` and `target profile` are different subjects.
- Unsupported target-profile media metrics and insights must remain `UNAVAILABLE`.
- Connected-account data must never be copied into third-party target-profile fields.
- `ProfileSnapshot.rawResponse` must keep `providerPayload`, `normalizedPayload`, `providerVariant`, and `subjectType`.
- Plaintext tokens must never be logged or returned from APIs.
- Canonical wording is `Instagram API with Instagram Login`.

## What Moves Together

### If you change OAuth or provider behavior

Update all of:

- `providers/instagram-official.provider.ts`
- `types/instagram-api.types.ts`
- `instagram.service.ts`
- provider/service tests

### If you change queue payloads

Update all of:

- `queues/instagram-fetch.queue.ts`
- `queues/instagram-fetch.processor.ts`
- `instagram.service.ts`
- service/processor tests

### If you change `/api/v1/instagram/status`

Update all of:

- `instagram.service.ts`
- `instagram.controller.ts`
- `../../../../frontend/src/types/api.ts`
- `../../../../frontend/src/app/(dashboard)/settings/instagram/page.tsx`

### If you change snapshot or token persistence

Update all of:

- `../../../../backend/prisma/schema.prisma`
- migration files
- `instagram.service.ts`
- Prisma generate output
- docs under `docs/agent-system/`

## Verification

Run these before finishing:

```bash
npx prisma generate --schema=backend/prisma/schema.prisma
npm run typecheck --workspace=backend
npm run test --workspace=backend
npm run build --workspace=backend
npm run typecheck --workspace=frontend
npm run test --workspace=frontend
npm run build --workspace=frontend
git diff --check
```

## Wording Regression Check

Before finishing, make sure deprecated wording was not reintroduced:

```bash
rg -n "Instagram Graph API|Facebook Login|instagram_basic|instagram_content_publish" README.md backend/.env.example backend/src/main.ts frontend/src/app docs backend/src/modules -S
```

Expected:

- no matches in current runtime code or current source-of-truth docs
- historical matches are acceptable only in migration-history documents
