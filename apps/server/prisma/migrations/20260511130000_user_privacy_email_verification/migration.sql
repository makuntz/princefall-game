-- AlterTable
ALTER TABLE "User" ADD COLUMN "privacyAcceptedAt" TIMESTAMP(3),
ADD COLUMN "emailVerifiedAt" TIMESTAMP(3),
ADD COLUMN "emailVerificationToken" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "User_emailVerificationToken_key" ON "User"("emailVerificationToken");

-- Contas existentes: consideramos aceite e e-mail verificados na data de criação (boas práticas de migração).
UPDATE "User"
SET
  "privacyAcceptedAt" = "createdAt",
  "emailVerifiedAt" = "createdAt"
WHERE "privacyAcceptedAt" IS NULL;
