-- Reversão MANUAL da migração player_hub_v3 (o Prisma não executa este arquivo).
-- Faça um backup antes (npm run db:backup). As horas registradas em sessões ficam
-- somadas em "playTimeMinutes", então nada de tempo jogado se perde ao voltar.
--
-- 1) O PostgreSQL não remove valores de enum. Jogos "Jogando" voltam a "Não iniciado"
--    e o tipo é recriado sem PLAYING.
BEGIN;
UPDATE "Game" SET "playStatus" = 'NOT_STARTED' WHERE "playStatus" = 'PLAYING';
ALTER TABLE "Game" ALTER COLUMN "playStatus" DROP DEFAULT;
ALTER TYPE "PlayStatus" RENAME TO "PlayStatus_v3";
CREATE TYPE "PlayStatus" AS ENUM ('NOT_STARTED', 'COMPLETED', 'ABANDONED');
ALTER TABLE "Game" ALTER COLUMN "playStatus" TYPE "PlayStatus" USING "playStatus"::text::"PlayStatus";
ALTER TABLE "Game" ALTER COLUMN "playStatus" SET DEFAULT 'NOT_STARTED';
DROP TYPE "PlayStatus_v3";

-- 2) Tabelas novas (perfil, favoritos, coleções, diário, histórico de preços, gamificação).
DROP TABLE "PlayerGoal", "XpTransaction", "UserAchievement", "PlayerActivity",
  "WishlistPriceEntry", "GameSession", "GameCollectionItem", "GameCollection",
  "FavoriteGame", "PlayerProfile";

-- 3) Colunas novas de Game.
ALTER TABLE "Game" DROP CONSTRAINT "Game_legacy_minutes_valid",
  DROP CONSTRAINT "Game_target_price_non_negative",
  DROP CONSTRAINT "Game_preferredStoreId_fkey";
DROP INDEX "Game_ownerId_playStatus_idx", "Game_preferredStoreId_idx", "Game_id_ownerId_key";
ALTER TABLE "Game" DROP COLUMN "completedAt", DROP COLUMN "legacyPlayMinutes",
  DROP COLUMN "preferredStoreId", DROP COLUMN "targetPrice", DROP COLUMN "wishNotes",
  DROP COLUMN "wishPriority";
DROP TYPE "WishPriority", "GoalType";

DELETE FROM "_prisma_migrations" WHERE "migration_name" = '20261109230000_player_hub_v3';
COMMIT;
