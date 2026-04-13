-- Partidas antigas em mode_select: avançar para setup (imperial) ou playing (tradicional)
UPDATE "Game"
SET
  phase = CASE
    WHEN COALESCE("gameMode", 'imperial') = 'traditional' THEN 'playing'
    ELSE 'setup'
  END,
  "turnStartedAt" = CASE
    WHEN COALESCE("gameMode", 'imperial') = 'traditional' THEN COALESCE("turnStartedAt", NOW())
    ELSE NULL
  END,
  version = version + 1
WHERE phase = 'mode_select';
