-- CreateTable
CREATE TABLE "instagram_tokens" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "encryptedToken" TEXT NOT NULL,
    "tokenType" TEXT NOT NULL DEFAULT 'USER_LONG_LIVED',
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "instagramUserId" TEXT NOT NULL,
    "scope" TEXT NOT NULL,
    "refreshedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "instagram_tokens_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "instagram_tokens_userId_key" ON "instagram_tokens"("userId");

-- AddForeignKey
ALTER TABLE "instagram_tokens" ADD CONSTRAINT "instagram_tokens_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
