# Instagram Module Claude Code Handoff Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give a zero-context Claude Code worker enough repository-specific context to safely implement or modify Instagram integration changes without breaking contracts.

**Architecture:** The Instagram module is split into four responsibilities: controller for public routes, service for orchestration and persistence, provider for all Instagram HTTP/OAuth details, and queue/Redis services for asynchronous execution and rate limiting. The most important domain rule is that `connected account` and `target profile` are separate subjects; unsupported target-profile metrics must stay `UNAVAILABLE` and must never be backfilled from the connected account.

**Tech Stack:** NestJS, Prisma, Bull, Redis, Next.js, Vitest, Puppeteer

---

## Read Order

Read these files in this order before changing anything:

1. `backend/src/modules/instagram/instagram.constants.ts`
2. `backend/src/modules/instagram/queues/instagram-fetch.queue.ts`
3. `backend/src/modules/instagram/instagram.controller.ts`
4. `backend/src/modules/instagram/instagram.service.ts`
5. `backend/src/modules/instagram/providers/instagram-official.provider.ts`
6. `backend/src/modules/instagram/instagram-rate-limit.service.ts`
7. `backend/prisma/schema.prisma`
8. `frontend/src/types/api.ts`
9. `frontend/src/app/(dashboard)/settings/instagram/page.tsx`
10. `docs/agent-system/adr-005-instagram-api-with-instagram-login.md`
11. `docs/agent-system/instagram-source-evaluation.md`

## Non-Negotiable Invariants

- Public routes stay stable: `/api/v1/auth/instagram`, `/api/v1/auth/instagram/callback`, `/api/v1/instagram/status`, `/api/v1/instagram/disconnect`, `/api/v1/influencer-profiles/:profileId/fetch`
- `InstagramOfficialProvider` owns OAuth URLs, scopes, endpoint URLs, retry logic, and raw HTTP calls
- `InstagramService` owns orchestration, DB persistence, queue enqueueing, and snapshot normalization
- Queue payloads must carry explicit subject metadata; do not re-derive target subject inside the worker if the payload can carry it
- `connected account` data must never be used to fill missing `target profile` media or insight fields
- `ProfileSnapshot.rawResponse` must keep `providerPayload`, `normalizedPayload`, `providerVariant`, and `subjectType`
- Plaintext Instagram tokens must never be logged or returned in API responses
- Rate limiting must go through `InstagramRateLimitService`; do not reintroduce ad hoc sleeps in business logic
- Canonical public wording is `Instagram API with Instagram Login`

## File Map

- `backend/src/modules/instagram/instagram.controller.ts`
  Public HTTP surface. Additive changes only.
- `backend/src/modules/instagram/instagram.service.ts`
  Main orchestration layer. This is the integration hub.
- `backend/src/modules/instagram/providers/instagram-official.provider.ts`
  All Instagram HTTP/OAuth behavior and retry rules.
- `backend/src/modules/instagram/queues/instagram-fetch.queue.ts`
  Internal queue contract. Treat as a typed API between enqueue and worker.
- `backend/src/modules/instagram/queues/instagram-fetch.processor.ts`
  Queue executor. Wraps work in Redis-backed exclusivity.
- `backend/src/modules/instagram/instagram-rate-limit.service.ts`
  Redis rate limiter and worker serialization helper.
- `backend/prisma/schema.prisma`
  Persistence contract for `InstagramToken` and `ProfileSnapshot`.
- `frontend/src/types/api.ts`
  Frontend API contract for `/api/v1/instagram/status`.
- `frontend/src/app/(dashboard)/settings/instagram/page.tsx`
  User-facing Instagram settings/status screen.
- `backend/src/main.ts`
  Meta App Review static pages.
- `docs/agent-system/adr-005-instagram-api-with-instagram-login.md`
  Current design source of truth.
- `docs/agent-system/instagram-source-evaluation.md`
  Capability matrix and compliance constraints.

### Task 1: Establish Baseline Before Editing

**Files:**
- Read: `backend/src/modules/instagram/instagram.service.ts`
- Read: `backend/src/modules/instagram/providers/instagram-official.provider.ts`
- Read: `backend/src/modules/instagram/queues/instagram-fetch.queue.ts`
- Read: `backend/prisma/schema.prisma`
- Test: `backend/src/modules/instagram/instagram.service.spec.ts`
- Test: `backend/src/modules/instagram/providers/instagram-official.provider.spec.ts`

- [ ] **Step 1: Confirm local prerequisites**

Run:

```bash
node -v
npm -v
```

Expected:
- Node is `>=20`
- npm is `>=10`

- [ ] **Step 2: Confirm required backend env keys exist**

Run:

```bash
rg -n "INSTAGRAM_CLIENT_ID|INSTAGRAM_CLIENT_SECRET|INSTAGRAM_REDIRECT_URI|INSTAGRAM_API_VERSION|INSTAGRAM_OAUTH_SCOPES|TOKEN_ENCRYPTION_KEY|REDIS_HOST|REDIS_PORT" backend/.env.local backend/.env.example -S
```

Expected:
- All keys appear
- `INSTAGRAM_OAUTH_SCOPES` is `instagram_business_basic,instagram_business_manage_insights`

- [ ] **Step 3: Run the current backend baseline**

Run:

```bash
npm run typecheck --workspace=backend
npm run test --workspace=backend
```

Expected:
- Typecheck passes
- Backend tests pass before any edit

- [ ] **Step 4: Run the current frontend baseline**

Run:

```bash
npm run typecheck --workspace=frontend
npm run test --workspace=frontend
```

Expected:
- Typecheck passes
- Frontend tests pass before any edit

### Task 2: Preserve the Provider / Service Boundary

**Files:**
- Modify: `backend/src/modules/instagram/providers/instagram-official.provider.ts`
- Modify: `backend/src/modules/instagram/types/instagram-api.types.ts`
- Modify: `backend/src/modules/instagram/instagram.service.ts`
- Test: `backend/src/modules/instagram/instagram-api.client.spec.ts`
- Test: `backend/src/modules/instagram/providers/instagram-official.provider.spec.ts`
- Test: `backend/src/modules/instagram/instagram.service.spec.ts`

- [ ] **Step 1: Keep HTTP details inside the provider**

If you add a new Instagram endpoint, add it to the provider first. Follow the existing pattern:

```ts
async fetchTargetMedia(
  targetAccountId: string,
  accessToken: string,
  limit = 25,
): Promise<InstagramMedia[]> {
  return this.getRecentMedia(accessToken, targetAccountId, limit)
}
```

Do not put endpoint URLs, scope strings, retry loops, or `fetch()` calls in `InstagramService`.

- [ ] **Step 2: Keep orchestration inside the service**

If a new provider method is added, wire it into the service in the same style:

```ts
await this.rateLimitService.waitForRequestWindow(
  providerVariant,
  requestedByUserId,
)
const profileData = await this.provider.fetchTargetProfile(
  targetUsername,
  connectedAccount.id,
  accessToken,
)
```

Service responsibilities are:
- decrypt / encrypt tokens
- DB reads and writes
- queue enqueueing
- snapshot shaping
- subject-type decisions

- [ ] **Step 3: Update provider return types first, then service usage**

When adding a provider field:

1. Update `backend/src/modules/instagram/types/instagram-api.types.ts`
2. Update provider mapping
3. Update service persistence
4. Update tests

Do not skip step 1. The type file is the contract that keeps service changes from drifting.

### Task 3: Preserve Connected-Account vs Target-Profile Separation

**Files:**
- Modify: `backend/src/modules/instagram/instagram.constants.ts`
- Modify: `backend/src/modules/instagram/queues/instagram-fetch.queue.ts`
- Modify: `backend/src/modules/instagram/queues/instagram-fetch.processor.ts`
- Modify: `backend/src/modules/instagram/instagram.service.ts`
- Modify: `backend/prisma/schema.prisma`
- Test: `backend/src/modules/instagram/instagram.service.spec.ts`

- [ ] **Step 1: Keep the queue payload explicit**

The current queue contract is:

```ts
export type MediaInsightsJob = {
  type: 'MEDIA_INSIGHTS'
  profileId: string
  requestedByUserId: string
  targetAccountId: string
  subjectType: InstagramSubjectType
  providerVariant: InstagramProviderVariant
  priority: 5
}
```

If you change worker behavior, update this contract first. Do not hide subject decisions inside the processor.

- [ ] **Step 2: Keep subject typing explicit in the service**

The current split is decided here:

```ts
const subjectType: InstagramSubjectType =
  profileData.id === connectedAccount.id
    ? INSTAGRAM_SUBJECT_TYPES.CONNECTED_ACCOUNT
    : INSTAGRAM_SUBJECT_TYPES.TARGET_PROFILE
```

Any new metric or snapshot behavior must branch on `subjectType` or an equivalent explicit decision.

- [ ] **Step 3: Preserve `UNAVAILABLE` behavior for unsupported target-profile data**

If the target profile is not the connected account, unsupported media insights must remain unavailable. Do not write code that copies a connected account metric into a third-party target profile field.

Before finalizing a change, search for all branches that touch `UNAVAILABLE`:

```bash
rg -n "UNAVAILABLE|TARGET_PROFILE|CONNECTED_ACCOUNT|subjectType" backend/src/modules/instagram -S
```

Expected:
- Every newly added metric has a clear unavailable branch when required

- [ ] **Step 4: Keep persistence metadata in sync**

If snapshot behavior changes, verify `ProfileSnapshot` still writes:

```ts
rawResponse: {
  providerPayload,
  normalizedPayload,
  providerVariant,
  subjectType,
}
```

If you add schema columns:

```bash
npx prisma generate --schema=backend/prisma/schema.prisma
```

Then add a migration and update docs.

### Task 4: Sync Public Surface and Documentation with Backend Changes

**Files:**
- Modify: `frontend/src/types/api.ts`
- Modify: `frontend/src/app/(dashboard)/settings/instagram/page.tsx`
- Modify: `backend/src/main.ts`
- Modify: `backend/src/modules/ai/prompts/brand-fit.prompt.ts`
- Modify: `backend/src/modules/ai/prompts/risk.prompt.ts`
- Modify: `backend/src/modules/report/generators/pdf-generator.service.ts`
- Modify: `docs/agent-system/adr-005-instagram-api-with-instagram-login.md`
- Modify: `docs/agent-system/instagram-source-evaluation.md`
- Modify: `docs/production-secrets-guide.md`

- [ ] **Step 1: If `/api/v1/instagram/status` changes, update frontend types first**

Current frontend contract:

```ts
export interface InstagramConnectionStatus {
  connected: boolean
  username?: string
  connectedAt?: string
  provider?: string
  scopes?: string[]
  expiresAt?: string
  tokenStatus?: string
}
```

Do not change backend status response without updating this file and the settings page together.

- [ ] **Step 2: Keep wording canonical**

Before final review, run:

```bash
rg -n "Instagram Graph API|Facebook Login|instagram_basic|instagram_content_publish" README.md backend/.env.example backend/src/main.ts frontend/src/app docs backend/src/modules -S
```

Expected:
- No matches in current source-of-truth docs or product surface
- Historical matches are acceptable only in `docs/development/instagram-oauth-migration.md` and the superseded ADR history

- [ ] **Step 3: Update docs when contracts change**

If you change any of these, update docs in the same change:
- env vars
- OAuth scopes
- queue payload shape
- snapshot metadata
- status API fields
- wording shown to Meta App Review reviewers

### Task 5: Final Verification Before Handoff

**Files:**
- Verify changed files only

- [ ] **Step 1: Run code generation if Prisma changed**

Run:

```bash
npx prisma generate --schema=backend/prisma/schema.prisma
```

Expected:
- Prisma client regenerates without schema errors

- [ ] **Step 2: Run full verification**

Run:

```bash
npm run typecheck --workspace=backend
npm run test --workspace=backend
npm run build --workspace=backend
npm run typecheck --workspace=frontend
npm run test --workspace=frontend
npm run build --workspace=frontend
```

Expected:
- All commands exit `0`

- [ ] **Step 3: Run diff hygiene checks**

Run:

```bash
git diff --check
git diff --stat
```

Expected:
- No whitespace or patch-format issues
- Only intended files changed

- [ ] **Step 4: Re-run wording regression scan**

Run:

```bash
rg -n "Instagram Graph API|Facebook Login|instagram_basic|instagram_content_publish" README.md backend/.env.example backend/src/main.ts frontend/src/app docs backend/src/modules -S
```

Expected:
- No accidental reintroduction of deprecated wording in current runtime or product docs

## Stop Conditions

Stop and ask for clarification if any of these happen:

- You are about to break a public route shape instead of making an additive change
- You need to use connected-account data to fill a third-party target profile field
- The change requires unsupported Meta scopes beyond `instagram_business_basic` and `instagram_business_manage_insights`
- Prisma schema changes would require destructive migration steps
- Legal pages or Meta App Review wording would knowingly diverge from actual implementation

## Quick Commands

```bash
npm run start:dev --workspace=backend
npm run dev --workspace=frontend
npm run typecheck --workspace=backend
npm run test --workspace=backend
npm run typecheck --workspace=frontend
npm run test --workspace=frontend
npx prisma generate --schema=backend/prisma/schema.prisma
```

## Success Criteria

- A Claude Code worker can identify the correct entry file within 2 minutes
- A worker touching provider logic knows not to edit service HTTP concerns
- A worker touching snapshots knows to preserve `providerVariant` and `subjectType`
- A worker touching settings/status knows which frontend and backend files move together
- A worker can run the exact verification commands without guessing
