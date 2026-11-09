-- Biblioteca de Jogos 3.0 (Player Hub). Gerado com prisma migrate diff e revisado à mão.
-- Aditiva: nenhum dado existente é apagado. Reversão manual em down.sql (o valor de enum
-- PLAYING não pode ser removido com ALTER TYPE; veja as instruções lá).

-- CreateEnum
CREATE TYPE "WishPriority" AS ENUM ('LOW', 'MEDIUM', 'HIGH');

-- CreateEnum
CREATE TYPE "GoalType" AS ENUM ('COMPLETE_GAMES', 'PLAY_HOURS', 'COMPLETE_CATEGORY', 'COMPLETE_BACKLOG');

-- AlterEnum
ALTER TYPE "PlayStatus" ADD VALUE 'PLAYING';

-- AlterTable
ALTER TABLE "Game" ADD COLUMN     "completedAt" TIMESTAMP(3),
ADD COLUMN     "legacyPlayMinutes" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "preferredStoreId" UUID,
ADD COLUMN     "targetPrice" DECIMAL(12,2),
ADD COLUMN     "wishNotes" VARCHAR(1000),
ADD COLUMN     "wishPriority" "WishPriority";

-- CreateTable
CREATE TABLE "PlayerProfile" (
    "userId" UUID NOT NULL,
    "username" VARCHAR(30) NOT NULL,
    "displayName" VARCHAR(60) NOT NULL,
    "bio" VARCHAR(400),
    "avatarKey" VARCHAR(80),
    "bannerKey" VARCHAR(80),
    "titleCode" VARCHAR(40),
    "totalXp" INTEGER NOT NULL DEFAULT 0,
    "level" INTEGER NOT NULL DEFAULT 1,
    "backfilledAt" TIMESTAMP(3),
    "notificationsSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "isPublic" BOOLEAN NOT NULL DEFAULT false,
    "showFavorites" BOOLEAN NOT NULL DEFAULT true,
    "showAchievements" BOOLEAN NOT NULL DEFAULT true,
    "showActivity" BOOLEAN NOT NULL DEFAULT false,
    "showPlayStats" BOOLEAN NOT NULL DEFAULT true,
    "showLibrary" BOOLEAN NOT NULL DEFAULT false,
    "showWishlist" BOOLEAN NOT NULL DEFAULT false,
    "showOriginalValue" BOOLEAN NOT NULL DEFAULT false,
    "showPaidTotal" BOOLEAN NOT NULL DEFAULT false,
    "showSavings" BOOLEAN NOT NULL DEFAULT false,
    "showStoreRanking" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PlayerProfile_pkey" PRIMARY KEY ("userId")
);

-- CreateTable
CREATE TABLE "FavoriteGame" (
    "ownerId" UUID NOT NULL,
    "gameId" UUID NOT NULL,
    "position" INTEGER NOT NULL DEFAULT 0,
    "showOnProfile" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FavoriteGame_pkey" PRIMARY KEY ("ownerId","gameId")
);

-- CreateTable
CREATE TABLE "GameCollection" (
    "id" UUID NOT NULL,
    "ownerId" UUID NOT NULL,
    "name" VARCHAR(80) NOT NULL,
    "normalizedName" VARCHAR(80) NOT NULL,
    "description" VARCHAR(500),
    "isPublic" BOOLEAN NOT NULL DEFAULT false,
    "coverGameId" UUID,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GameCollection_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GameCollectionItem" (
    "collectionId" UUID NOT NULL,
    "gameId" UUID NOT NULL,
    "ownerId" UUID NOT NULL,
    "position" INTEGER NOT NULL DEFAULT 0,
    "addedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "GameCollectionItem_pkey" PRIMARY KEY ("collectionId","gameId")
);

-- CreateTable
CREATE TABLE "GameSession" (
    "id" UUID NOT NULL,
    "ownerId" UUID NOT NULL,
    "gameId" UUID NOT NULL,
    "playedOn" DATE NOT NULL,
    "durationMinutes" INTEGER NOT NULL,
    "startedAt" TIMESTAMP(3),
    "endedAt" TIMESTAMP(3),
    "notes" VARCHAR(1000),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GameSession_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WishlistPriceEntry" (
    "id" UUID NOT NULL,
    "gameId" UUID NOT NULL,
    "ownerId" UUID NOT NULL,
    "price" DECIMAL(12,2) NOT NULL,
    "storeId" UUID,
    "recordedOn" DATE NOT NULL,
    "note" VARCHAR(200),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WishlistPriceEntry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PlayerActivity" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "type" VARCHAR(30) NOT NULL,
    "dedupeKey" VARCHAR(120),
    "gameId" UUID,
    "entityId" UUID,
    "data" JSONB NOT NULL DEFAULT '{}',
    "retroactive" BOOLEAN NOT NULL DEFAULT false,
    "occurredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PlayerActivity_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserAchievement" (
    "userId" UUID NOT NULL,
    "code" VARCHAR(40) NOT NULL,
    "unlockedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "retroactive" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "UserAchievement_pkey" PRIMARY KEY ("userId","code")
);

-- CreateTable
CREATE TABLE "XpTransaction" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "eventKey" VARCHAR(120) NOT NULL,
    "source" VARCHAR(30) NOT NULL,
    "amount" INTEGER NOT NULL,
    "description" VARCHAR(200) NOT NULL,
    "retroactive" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "XpTransaction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PlayerGoal" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "name" VARCHAR(80) NOT NULL,
    "type" "GoalType" NOT NULL,
    "startsOn" DATE NOT NULL,
    "endsOn" DATE NOT NULL,
    "targetValue" INTEGER NOT NULL,
    "categoryName" VARCHAR(40),
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PlayerGoal_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "PlayerProfile_username_key" ON "PlayerProfile"("username");

-- CreateIndex
CREATE INDEX "FavoriteGame_ownerId_position_idx" ON "FavoriteGame"("ownerId", "position");

-- CreateIndex
CREATE INDEX "FavoriteGame_gameId_ownerId_idx" ON "FavoriteGame"("gameId", "ownerId");

-- CreateIndex
CREATE INDEX "GameCollection_coverGameId_idx" ON "GameCollection"("coverGameId");

-- CreateIndex
CREATE UNIQUE INDEX "GameCollection_ownerId_normalizedName_key" ON "GameCollection"("ownerId", "normalizedName");

-- CreateIndex
CREATE UNIQUE INDEX "GameCollection_id_ownerId_key" ON "GameCollection"("id", "ownerId");

-- CreateIndex
CREATE INDEX "GameCollectionItem_gameId_ownerId_idx" ON "GameCollectionItem"("gameId", "ownerId");

-- CreateIndex
CREATE INDEX "GameCollectionItem_collectionId_ownerId_idx" ON "GameCollectionItem"("collectionId", "ownerId");

-- CreateIndex
CREATE INDEX "GameSession_ownerId_playedOn_idx" ON "GameSession"("ownerId", "playedOn");

-- CreateIndex
CREATE INDEX "GameSession_gameId_ownerId_idx" ON "GameSession"("gameId", "ownerId");

-- CreateIndex
CREATE INDEX "WishlistPriceEntry_gameId_ownerId_idx" ON "WishlistPriceEntry"("gameId", "ownerId");

-- CreateIndex
CREATE INDEX "WishlistPriceEntry_storeId_idx" ON "WishlistPriceEntry"("storeId");

-- CreateIndex
CREATE INDEX "PlayerActivity_userId_occurredAt_idx" ON "PlayerActivity"("userId", "occurredAt");

-- CreateIndex
CREATE INDEX "PlayerActivity_gameId_idx" ON "PlayerActivity"("gameId");

-- CreateIndex
CREATE UNIQUE INDEX "PlayerActivity_userId_dedupeKey_key" ON "PlayerActivity"("userId", "dedupeKey");

-- CreateIndex
CREATE INDEX "XpTransaction_userId_source_createdAt_idx" ON "XpTransaction"("userId", "source", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "XpTransaction_userId_eventKey_key" ON "XpTransaction"("userId", "eventKey");

-- CreateIndex
CREATE INDEX "PlayerGoal_userId_endsOn_idx" ON "PlayerGoal"("userId", "endsOn");

-- CreateIndex
CREATE INDEX "Game_ownerId_playStatus_idx" ON "Game"("ownerId", "playStatus");

-- CreateIndex
CREATE INDEX "Game_preferredStoreId_idx" ON "Game"("preferredStoreId");

-- CreateIndex
CREATE UNIQUE INDEX "Game_id_ownerId_key" ON "Game"("id", "ownerId");

-- AddForeignKey
ALTER TABLE "Game" ADD CONSTRAINT "Game_preferredStoreId_fkey" FOREIGN KEY ("preferredStoreId") REFERENCES "Store"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlayerProfile" ADD CONSTRAINT "PlayerProfile_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FavoriteGame" ADD CONSTRAINT "FavoriteGame_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FavoriteGame" ADD CONSTRAINT "FavoriteGame_gameId_ownerId_fkey" FOREIGN KEY ("gameId", "ownerId") REFERENCES "Game"("id", "ownerId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GameCollection" ADD CONSTRAINT "GameCollection_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GameCollection" ADD CONSTRAINT "GameCollection_coverGameId_fkey" FOREIGN KEY ("coverGameId") REFERENCES "Game"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GameCollectionItem" ADD CONSTRAINT "GameCollectionItem_collectionId_ownerId_fkey" FOREIGN KEY ("collectionId", "ownerId") REFERENCES "GameCollection"("id", "ownerId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GameCollectionItem" ADD CONSTRAINT "GameCollectionItem_gameId_ownerId_fkey" FOREIGN KEY ("gameId", "ownerId") REFERENCES "Game"("id", "ownerId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GameSession" ADD CONSTRAINT "GameSession_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GameSession" ADD CONSTRAINT "GameSession_gameId_ownerId_fkey" FOREIGN KEY ("gameId", "ownerId") REFERENCES "Game"("id", "ownerId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WishlistPriceEntry" ADD CONSTRAINT "WishlistPriceEntry_gameId_ownerId_fkey" FOREIGN KEY ("gameId", "ownerId") REFERENCES "Game"("id", "ownerId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WishlistPriceEntry" ADD CONSTRAINT "WishlistPriceEntry_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "Store"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlayerActivity" ADD CONSTRAINT "PlayerActivity_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlayerActivity" ADD CONSTRAINT "PlayerActivity_gameId_fkey" FOREIGN KEY ("gameId") REFERENCES "Game"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserAchievement" ADD CONSTRAINT "UserAchievement_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "XpTransaction" ADD CONSTRAINT "XpTransaction_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlayerGoal" ADD CONSTRAINT "PlayerGoal_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- ---------------------------------------------------------------------------
-- Migração de dados (escrita à mão)
-- ---------------------------------------------------------------------------

-- Horas já cadastradas viram o saldo inicial (sem data). As sessões novas somam por cima,
-- então nenhuma hora antiga é contada duas vezes.
UPDATE "Game" SET "legacyPlayMinutes" = "playTimeMinutes";

-- O "preço atual" informado antes vira o primeiro registro do histórico, na data em que foi
-- informado. completedAt dos jogos já zerados fica NULL: a data real não é conhecida.
INSERT INTO "WishlistPriceEntry" ("id", "gameId", "ownerId", "price", "recordedOn", "note")
SELECT gen_random_uuid(), g."id", g."ownerId", g."currentWishPrice",
       COALESCE(g."wishPriceUpdatedAt", g."updatedAt")::date, 'Preço informado antes do histórico'
FROM "Game" g
WHERE g."ownershipStatus" = 'WISHLIST' AND g."currentWishPrice" IS NOT NULL;

-- ---------------------------------------------------------------------------
-- Restrições adicionais (não expressáveis no schema.prisma)
-- Os CHECKs e índices parciais da migração init continuam valendo e NÃO são tocados.
-- ---------------------------------------------------------------------------

ALTER TABLE "Game" ADD CONSTRAINT "Game_legacy_minutes_valid" CHECK (
  "legacyPlayMinutes" >= 0 AND "legacyPlayMinutes" <= "playTimeMinutes"
);
ALTER TABLE "Game" ADD CONSTRAINT "Game_target_price_non_negative" CHECK ("targetPrice" IS NULL OR "targetPrice" >= 0);

ALTER TABLE "PlayerProfile" ADD CONSTRAINT "PlayerProfile_username_format" CHECK ("username" ~ '^[a-z0-9][a-z0-9_-]{2,29}$');
ALTER TABLE "PlayerProfile" ADD CONSTRAINT "PlayerProfile_progress_valid" CHECK ("totalXp" >= 0 AND "level" >= 1);

ALTER TABLE "GameSession" ADD CONSTRAINT "GameSession_duration_range" CHECK ("durationMinutes" BETWEEN 1 AND 1440);
ALTER TABLE "GameSession" ADD CONSTRAINT "GameSession_interval_order" CHECK (
  "startedAt" IS NULL OR "endedAt" IS NULL OR "endedAt" > "startedAt"
);

ALTER TABLE "WishlistPriceEntry" ADD CONSTRAINT "WishlistPriceEntry_price_non_negative" CHECK ("price" >= 0);

ALTER TABLE "PlayerGoal" ADD CONSTRAINT "PlayerGoal_target_positive" CHECK ("targetValue" > 0);
ALTER TABLE "PlayerGoal" ADD CONSTRAINT "PlayerGoal_period_order" CHECK ("endsOn" >= "startsOn");

ALTER TABLE "XpTransaction" ADD CONSTRAINT "XpTransaction_amount_positive" CHECK ("amount" > 0);

