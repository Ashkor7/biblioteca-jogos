-- Reversão manual da migração steam_import (rode com o banco em backup: npm run db:backup).
-- Remove só o que esta migração criou; jogos importados continuam como jogos comuns.
DROP TABLE IF EXISTS "SteamSyncJobItem";
DROP TABLE IF EXISTS "SteamSyncJob";
DROP TABLE IF EXISTS "SteamIgnoredApp";
DROP TABLE IF EXISTS "SteamAppCache";
DROP TABLE IF EXISTS "SteamAccount";
DROP INDEX IF EXISTS "Game_one_steam_app_per_owner";
DROP INDEX IF EXISTS "Game_ownerId_source_idx";
ALTER TABLE "Game"
  DROP CONSTRAINT IF EXISTS "Game_steam_app_positive",
  DROP CONSTRAINT IF EXISTS "Game_steam_playtime_non_negative",
  DROP CONSTRAINT IF EXISTS "Game_steam_achievements_valid",
  DROP CONSTRAINT IF EXISTS "Game_metacritic_range",
  DROP COLUMN IF EXISTS "description",
  DROP COLUMN IF EXISTS "developer",
  DROP COLUMN IF EXISTS "metacriticScore",
  DROP COLUMN IF EXISTS "publisher",
  DROP COLUMN IF EXISTS "releaseDate",
  DROP COLUMN IF EXISTS "releaseDateText",
  DROP COLUMN IF EXISTS "source",
  DROP COLUMN IF EXISTS "steamAchievementsTotal",
  DROP COLUMN IF EXISTS "steamAchievementsUnlocked",
  DROP COLUMN IF EXISTS "steamAppId",
  DROP COLUMN IF EXISTS "steamLastPlayedAt",
  DROP COLUMN IF EXISTS "steamPlaytimeMinutes",
  DROP COLUMN IF EXISTS "steamSyncedAt";
DROP TYPE IF EXISTS "SteamJobItemStatus";
DROP TYPE IF EXISTS "SteamJobStatus";
DROP TYPE IF EXISTS "GameSource";
DELETE FROM "_prisma_migrations" WHERE "migration_name" LIKE '%_steam_import';
