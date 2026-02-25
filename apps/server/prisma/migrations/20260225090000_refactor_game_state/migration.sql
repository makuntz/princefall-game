-- AlterTable: Adicionar novos campos (se não existirem)
DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'Game' AND column_name = 'board') THEN
    ALTER TABLE "Game" ADD COLUMN "board" JSONB DEFAULT '{}'::jsonb;
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'Game' AND column_name = 'phase') THEN
    ALTER TABLE "Game" ADD COLUMN "phase" TEXT DEFAULT 'waiting';
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'Game' AND column_name = 'whiteGeneralPos') THEN
    ALTER TABLE "Game" ADD COLUMN "whiteGeneralPos" JSONB;
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'Game' AND column_name = 'blackGeneralPos') THEN
    ALTER TABLE "Game" ADD COLUMN "blackGeneralPos" JSONB;
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'Game' AND column_name = 'whiteKingSwapped') THEN
    ALTER TABLE "Game" ADD COLUMN "whiteKingSwapped" BOOLEAN DEFAULT false;
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'Game' AND column_name = 'blackKingSwapped') THEN
    ALTER TABLE "Game" ADD COLUMN "blackKingSwapped" BOOLEAN DEFAULT false;
  END IF;
END $$;

-- Migrar dados do gameState antigo para os novos campos (se gameState existir)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'Game' AND column_name = 'gameState') THEN
    UPDATE "Game" SET
      "board" = COALESCE(("gameState"->>'board')::jsonb, '{}'::jsonb),
      "phase" = CASE 
        WHEN "status" = 'waiting' THEN 'waiting'
        WHEN "status" = 'setup' THEN 'setup'
        WHEN "status" = 'playing' AND "moveNumber" = 0 THEN 'coinflip'
        WHEN "status" = 'playing' THEN 'playing'
        WHEN "status" = 'finished' THEN 'finished'
        ELSE 'waiting'
      END,
      "whiteGeneralPos" = CASE 
        WHEN "gameState"->>'whiteGeneralPosition' IS NOT NULL 
        THEN ("gameState"->>'whiteGeneralPosition')::jsonb
        ELSE NULL
      END,
      "blackGeneralPos" = CASE 
        WHEN "gameState"->>'blackGeneralPosition' IS NOT NULL 
        THEN ("gameState"->>'blackGeneralPosition')::jsonb
        ELSE NULL
      END,
      "whiteKingSwapped" = COALESCE(("gameState"->>'whiteKingSwapped')::boolean, false),
      "blackKingSwapped" = COALESCE(("gameState"->>'blackKingSwapped')::boolean, false)
    WHERE "gameState" IS NOT NULL;
  ELSE
    -- Se gameState não existe, apenas garantir valores padrão
    UPDATE "Game" SET
      "board" = COALESCE("board", '{}'::jsonb),
      "phase" = COALESCE("phase", 'waiting'),
      "whiteKingSwapped" = COALESCE("whiteKingSwapped", false),
      "blackKingSwapped" = COALESCE("blackKingSwapped", false)
    WHERE "board" IS NULL OR "phase" IS NULL;
  END IF;
END $$;

-- Garantir que board não seja null para novos jogos
ALTER TABLE "Game" ALTER COLUMN "board" SET DEFAULT '{}'::jsonb;
DO $$ 
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'Game' AND column_name = 'board' AND is_nullable = 'YES') THEN
    ALTER TABLE "Game" ALTER COLUMN "board" SET NOT NULL;
  END IF;
END $$;

-- Remover colunas antigas (se existirem)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'Game' AND column_name = 'gameState') THEN
    ALTER TABLE "Game" DROP COLUMN "gameState";
  END IF;
  
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'Game' AND column_name = 'status') THEN
    ALTER TABLE "Game" DROP COLUMN "status";
  END IF;
END $$;

-- Criar índices
CREATE INDEX IF NOT EXISTS "Game_phase_idx" ON "Game"("phase");
