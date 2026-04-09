# Claude Code Implementation Prompt: Instagram Module

Use this prompt when you want Claude Code to implement or modify the Instagram module safely.

## Copy-Paste Prompt

```text
You are implementing changes in the Instagram module of this repository.

Work from the repository itself, not from memory.

Before editing, read these files in order:
1. backend/src/modules/instagram/README.md
2. backend/src/modules/instagram/instagram.constants.ts
3. backend/src/modules/instagram/queues/instagram-fetch.queue.ts
4. backend/src/modules/instagram/instagram.controller.ts
5. backend/src/modules/instagram/instagram.service.ts
6. backend/src/modules/instagram/providers/instagram-official.provider.ts
7. backend/src/modules/instagram/instagram-rate-limit.service.ts
8. backend/prisma/schema.prisma
9. frontend/src/types/api.ts
10. frontend/src/app/(dashboard)/settings/instagram/page.tsx
11. docs/agent-system/adr-005-instagram-api-with-instagram-login.md
12. docs/agent-system/instagram-source-evaluation.md
13. docs/superpowers/plans/2026-04-09-instagram-module-claude-code-handoff.md

Repository-specific rules:
- Public routes must remain stable:
  - /api/v1/auth/instagram
  - /api/v1/auth/instagram/callback
  - /api/v1/instagram/status
  - /api/v1/instagram/disconnect
  - /api/v1/influencer-profiles/:profileId/fetch
- InstagramOfficialProvider owns OAuth URLs, scopes, endpoint URLs, retry logic, and raw HTTP calls.
- InstagramService owns orchestration, DB persistence, token encryption/decryption, queue enqueueing, and snapshot shaping.
- connected account and target profile are separate subjects.
- Unsupported target-profile media metrics or insights must remain UNAVAILABLE.
- Never backfill third-party target-profile fields from connected-account data.
- Keep ProfileSnapshot.rawResponse structured with:
  - providerPayload
  - normalizedPayload
  - providerVariant
  - subjectType
- Never log or return plaintext Instagram tokens.
- Canonical wording is "Instagram API with Instagram Login".

Execution procedure:
1. Restate the requested change in one short paragraph.
2. Identify the smallest correct file set before editing.
3. If provider behavior changes, edit provider types and mappings before service logic.
4. If queue payload changes, update queue types before processor and service logic.
5. If status API changes, update backend service/controller and frontend types/settings page together.
6. If Prisma schema changes, add a migration and run prisma generate.
7. Update docs if contracts, scopes, persistence fields, or public wording change.
8. Run verification before claiming success.

Required verification:
- npx prisma generate --schema=backend/prisma/schema.prisma
- npm run typecheck --workspace=backend
- npm run test --workspace=backend
- npm run build --workspace=backend
- npm run typecheck --workspace=frontend
- npm run test --workspace=frontend
- npm run build --workspace=frontend
- git diff --check

Required wording regression scan:
- rg -n "Instagram Graph API|Facebook Login|instagram_basic|instagram_content_publish" README.md backend/.env.example backend/src/main.ts frontend/src/app docs backend/src/modules -S

Do not finish with a vague summary. Report:
- files changed
- invariants preserved
- verification commands run and result
- any residual risk
```

## Expected Use

- Give Claude Code the prompt above.
- Add one short paragraph after it describing the specific change you want.
- If the change is large, also point Claude Code to:
  `docs/superpowers/plans/2026-04-09-instagram-module-claude-code-handoff.md`

## When To Use This Prompt

- Adding Instagram fields
- Adjusting OAuth behavior
- Changing queue payloads
- Changing snapshot persistence
- Extending `/api/v1/instagram/status`
- Updating settings page behavior
- Syncing docs and wording with runtime changes
