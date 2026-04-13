ALTER TABLE "Game"
  ALTER COLUMN "whiteTimeMs" SET DEFAULT 600000,
  ALTER COLUMN "blackTimeMs" SET DEFAULT 600000;

UPDATE "Game"
SET
  "whiteTimeMs" = CASE WHEN "whiteTimeMs" = 300000 THEN 600000 ELSE "whiteTimeMs" END,
  "blackTimeMs" = CASE WHEN "blackTimeMs" = 300000 THEN 600000 ELSE "blackTimeMs" END
WHERE "whiteTimeMs" = 300000 OR "blackTimeMs" = 300000;
