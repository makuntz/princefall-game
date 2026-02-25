-- AlterTable: Adicionar campos de tempo e motivo de finalização
ALTER TABLE "Game" ADD COLUMN IF NOT EXISTS "whiteTimeMs" INTEGER DEFAULT 300000;
ALTER TABLE "Game" ADD COLUMN IF NOT EXISTS "blackTimeMs" INTEGER DEFAULT 300000;
ALTER TABLE "Game" ADD COLUMN IF NOT EXISTS "turnStartedAt" TIMESTAMP(3);
ALTER TABLE "Game" ADD COLUMN IF NOT EXISTS "finishedReason" TEXT;

-- Garantir valores padrão para jogos existentes
UPDATE "Game" SET
  "whiteTimeMs" = COALESCE("whiteTimeMs", 300000),
  "blackTimeMs" = COALESCE("blackTimeMs", 300000)
WHERE "whiteTimeMs" IS NULL OR "blackTimeMs" IS NULL;

