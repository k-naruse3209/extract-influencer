-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('ADMIN', 'ANALYST', 'VIEWER');

-- CreateEnum
CREATE TYPE "Platform" AS ENUM ('INSTAGRAM', 'TIKTOK');

-- CreateEnum
CREATE TYPE "DataStatus" AS ENUM ('FACT', 'ESTIMATED', 'UNAVAILABLE');

-- CreateEnum
CREATE TYPE "Confidence" AS ENUM ('LOW', 'MEDIUM', 'HIGH');

-- CreateEnum
CREATE TYPE "ScoreCategory" AS ENUM ('BRAND_FIT', 'RISK', 'PSEUDO_ACTIVITY', 'ENGAGEMENT', 'GROWTH');

-- CreateEnum
CREATE TYPE "AnalysisType" AS ENUM ('BRAND_FIT_COMMENT', 'RISK_COMMENT', 'AUDIENCE_INSIGHT', 'CONTENT_STYLE', 'COLLABORATION_SUGGESTION');

-- CreateEnum
CREATE TYPE "ReportType" AS ENUM ('SINGLE_PROFILE', 'COMPARISON', 'BATCH_EXPORT');

-- CreateEnum
CREATE TYPE "ReportFormat" AS ENUM ('PDF', 'CSV');

-- CreateEnum
CREATE TYPE "ReportStatus" AS ENUM ('PENDING', 'PROCESSING', 'COMPLETED', 'FAILED');

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "hashedPassword" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "role" "UserRole" NOT NULL DEFAULT 'VIEWER',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "lastLoginAt" TIMESTAMP(3),
    "deletedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "api_keys" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "hashedKey" TEXT NOT NULL,
    "prefix" TEXT NOT NULL,
    "lastUsedAt" TIMESTAMP(3),
    "expiresAt" TIMESTAMP(3),
    "isRevoked" BOOLEAN NOT NULL DEFAULT false,
    "deletedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "api_keys_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "influencer_profiles" (
    "id" TEXT NOT NULL,
    "platform" "Platform" NOT NULL DEFAULT 'INSTAGRAM',
    "username" TEXT NOT NULL,
    "displayName" TEXT,
    "profileUrl" TEXT,
    "deletedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "influencer_profiles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "profile_snapshots" (
    "id" TEXT NOT NULL,
    "profileId" TEXT NOT NULL,
    "dataSource" TEXT NOT NULL DEFAULT 'instagram_graph_api',
    "fetchedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "followerCount" INTEGER,
    "followerCountStatus" "DataStatus" NOT NULL DEFAULT 'FACT',
    "followingCount" INTEGER,
    "followingCountStatus" "DataStatus" NOT NULL DEFAULT 'FACT',
    "mediaCount" INTEGER,
    "mediaCountStatus" "DataStatus" NOT NULL DEFAULT 'FACT',
    "biography" TEXT,
    "biographyStatus" "DataStatus" NOT NULL DEFAULT 'FACT',
    "profilePictureUrl" TEXT,
    "isVerified" BOOLEAN,
    "isPrivate" BOOLEAN,
    "externalUrl" TEXT,
    "category" TEXT,
    "engagementRate" DOUBLE PRECISION,
    "engagementRateStatus" "DataStatus" NOT NULL DEFAULT 'ESTIMATED',
    "engagementRateConfidence" "Confidence",
    "avgLikesPerPost" DOUBLE PRECISION,
    "avgLikesPerPostStatus" "DataStatus" NOT NULL DEFAULT 'ESTIMATED',
    "avgCommentsPerPost" DOUBLE PRECISION,
    "avgCommentsPerPostStatus" "DataStatus" NOT NULL DEFAULT 'ESTIMATED',
    "rawResponse" JSONB,
    "deletedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "profile_snapshots_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "score_records" (
    "id" TEXT NOT NULL,
    "profileId" TEXT NOT NULL,
    "totalScore" DOUBLE PRECISION NOT NULL,
    "confidence" "Confidence" NOT NULL,
    "dataType" "DataStatus" NOT NULL DEFAULT 'ESTIMATED',
    "scoringModel" TEXT NOT NULL,
    "scoredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deletedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "score_records_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "score_breakdowns" (
    "id" TEXT NOT NULL,
    "scoreRecordId" TEXT NOT NULL,
    "category" "ScoreCategory" NOT NULL,
    "score" DOUBLE PRECISION NOT NULL,
    "confidence" "Confidence" NOT NULL,
    "weight" DOUBLE PRECISION NOT NULL,
    "rationale" TEXT,
    "dataType" "DataStatus" NOT NULL DEFAULT 'ESTIMATED',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "score_breakdowns_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ai_analyses" (
    "id" TEXT NOT NULL,
    "profileId" TEXT NOT NULL,
    "analysisType" "AnalysisType" NOT NULL,
    "content" TEXT NOT NULL,
    "llmModel" TEXT NOT NULL,
    "promptVersion" TEXT NOT NULL,
    "confidence" "Confidence" NOT NULL,
    "dataType" "DataStatus" NOT NULL DEFAULT 'ESTIMATED',
    "generatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deletedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ai_analyses_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "saved_candidates" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "profileId" TEXT NOT NULL,
    "note" TEXT,
    "tags" TEXT[],
    "deletedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "saved_candidates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "comparison_sessions" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "name" TEXT,
    "deletedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "comparison_sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "comparison_items" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "profileId" TEXT NOT NULL,
    "displayOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "comparison_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "reports" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "reportType" "ReportType" NOT NULL,
    "format" "ReportFormat" NOT NULL,
    "title" TEXT NOT NULL,
    "status" "ReportStatus" NOT NULL DEFAULT 'PENDING',
    "filePath" TEXT,
    "fileSize" INTEGER,
    "metadata" JSONB,
    "errorMessage" TEXT,
    "generatedAt" TIMESTAMP(3),
    "expiresAt" TIMESTAMP(3),
    "deletedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "reports_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_logs" (
    "id" TEXT NOT NULL,
    "userId" TEXT,
    "action" TEXT NOT NULL,
    "entity" TEXT NOT NULL,
    "entityId" TEXT,
    "details" JSONB,
    "ipAddress" TEXT,
    "performedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE INDEX "users_email_idx" ON "users"("email");

-- CreateIndex
CREATE INDEX "users_role_idx" ON "users"("role");

-- CreateIndex
CREATE UNIQUE INDEX "api_keys_hashedKey_key" ON "api_keys"("hashedKey");

-- CreateIndex
CREATE INDEX "api_keys_hashedKey_idx" ON "api_keys"("hashedKey");

-- CreateIndex
CREATE INDEX "api_keys_userId_idx" ON "api_keys"("userId");

-- CreateIndex
CREATE INDEX "influencer_profiles_platform_username_idx" ON "influencer_profiles"("platform", "username");

-- CreateIndex
CREATE UNIQUE INDEX "influencer_profiles_platform_username_key" ON "influencer_profiles"("platform", "username");

-- CreateIndex
CREATE INDEX "profile_snapshots_profileId_fetchedAt_idx" ON "profile_snapshots"("profileId", "fetchedAt" DESC);

-- CreateIndex
CREATE INDEX "profile_snapshots_fetchedAt_idx" ON "profile_snapshots"("fetchedAt" DESC);

-- CreateIndex
CREATE INDEX "score_records_profileId_scoredAt_idx" ON "score_records"("profileId", "scoredAt" DESC);

-- CreateIndex
CREATE INDEX "score_records_totalScore_idx" ON "score_records"("totalScore");

-- CreateIndex
CREATE INDEX "score_records_scoredAt_idx" ON "score_records"("scoredAt" DESC);

-- CreateIndex
CREATE INDEX "score_breakdowns_scoreRecordId_idx" ON "score_breakdowns"("scoreRecordId");

-- CreateIndex
CREATE INDEX "score_breakdowns_category_idx" ON "score_breakdowns"("category");

-- CreateIndex
CREATE INDEX "ai_analyses_profileId_analysisType_generatedAt_idx" ON "ai_analyses"("profileId", "analysisType", "generatedAt" DESC);

-- CreateIndex
CREATE INDEX "ai_analyses_generatedAt_idx" ON "ai_analyses"("generatedAt" DESC);

-- CreateIndex
CREATE INDEX "saved_candidates_userId_idx" ON "saved_candidates"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "saved_candidates_userId_profileId_key" ON "saved_candidates"("userId", "profileId");

-- CreateIndex
CREATE INDEX "comparison_sessions_userId_createdAt_idx" ON "comparison_sessions"("userId", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "comparison_items_sessionId_idx" ON "comparison_items"("sessionId");

-- CreateIndex
CREATE UNIQUE INDEX "comparison_items_sessionId_profileId_key" ON "comparison_items"("sessionId", "profileId");

-- CreateIndex
CREATE INDEX "reports_userId_createdAt_idx" ON "reports"("userId", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "reports_status_idx" ON "reports"("status");

-- CreateIndex
CREATE INDEX "audit_logs_performedAt_idx" ON "audit_logs"("performedAt" DESC);

-- CreateIndex
CREATE INDEX "audit_logs_userId_idx" ON "audit_logs"("userId");

-- CreateIndex
CREATE INDEX "audit_logs_entity_entityId_idx" ON "audit_logs"("entity", "entityId");

-- CreateIndex
CREATE INDEX "audit_logs_action_idx" ON "audit_logs"("action");

-- AddForeignKey
ALTER TABLE "api_keys" ADD CONSTRAINT "api_keys_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "profile_snapshots" ADD CONSTRAINT "profile_snapshots_profileId_fkey" FOREIGN KEY ("profileId") REFERENCES "influencer_profiles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "score_records" ADD CONSTRAINT "score_records_profileId_fkey" FOREIGN KEY ("profileId") REFERENCES "influencer_profiles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "score_breakdowns" ADD CONSTRAINT "score_breakdowns_scoreRecordId_fkey" FOREIGN KEY ("scoreRecordId") REFERENCES "score_records"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ai_analyses" ADD CONSTRAINT "ai_analyses_profileId_fkey" FOREIGN KEY ("profileId") REFERENCES "influencer_profiles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "saved_candidates" ADD CONSTRAINT "saved_candidates_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "saved_candidates" ADD CONSTRAINT "saved_candidates_profileId_fkey" FOREIGN KEY ("profileId") REFERENCES "influencer_profiles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "comparison_sessions" ADD CONSTRAINT "comparison_sessions_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "comparison_items" ADD CONSTRAINT "comparison_items_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "comparison_sessions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "comparison_items" ADD CONSTRAINT "comparison_items_profileId_fkey" FOREIGN KEY ("profileId") REFERENCES "influencer_profiles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reports" ADD CONSTRAINT "reports_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

