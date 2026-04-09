ALTER TABLE "instagram_tokens"
  ADD COLUMN "providerVariant" TEXT NOT NULL DEFAULT 'INSTAGRAM_LOGIN',
  ADD COLUMN "grantedScopes" TEXT,
  ADD COLUMN "tokenStatus" TEXT NOT NULL DEFAULT 'ACTIVE',
  ADD COLUMN "lastValidatedAt" TIMESTAMP(3);

UPDATE "instagram_tokens"
SET "providerVariant" = 'INSTAGRAM_LOGIN'
WHERE "providerVariant" IS NULL;

ALTER TABLE "profile_snapshots"
  ADD COLUMN "providerVariant" TEXT NOT NULL DEFAULT 'INSTAGRAM_LOGIN',
  ADD COLUMN "subjectType" TEXT NOT NULL DEFAULT 'TARGET_PROFILE';

UPDATE "profile_snapshots"
SET
  "providerVariant" = COALESCE("providerVariant", 'INSTAGRAM_LOGIN'),
  "subjectType" = COALESCE("subjectType", 'TARGET_PROFILE');
