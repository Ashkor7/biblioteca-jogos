-- CreateEnum
CREATE TYPE "GameSource" AS ENUM ('MANUAL', 'STEAM');

-- CreateEnum
CREATE TYPE "SteamJobStatus" AS ENUM ('PENDING', 'RUNNING', 'COMPLETED', 'FAILED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "SteamJobItemStatus" AS ENUM ('PENDING', 'DONE', 'FAILED', 'SKIPPED');

-- AlterTable
ALTER TABLE "Game" ADD COLUMN     "description" VARCHAR(1000),
ADD COLUMN     "developer" VARCHAR(120),
ADD COLUMN     "metacriticScore" SMALLINT,
ADD COLUMN     "publisher" VARCHAR(120),
ADD COLUMN     "releaseDate" DATE,
ADD COLUMN     "releaseDateText" VARCHAR(60),
ADD COLUMN     "source" "GameSource" NOT NULL DEFAULT 'MANUAL',
ADD COLUMN     "steamAchievementsTotal" INTEGER,
ADD COLUMN     "steamAchievementsUnlocked" INTEGER,
ADD COLUMN     "steamAppId" INTEGER,
ADD COLUMN     "steamLastPlayedAt" TIMESTAMP(3),
ADD COLUMN     "steamPlaytimeMinutes" INTEGER,
ADD COLUMN     "steamSyncedAt" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "SteamAccount" (
    "userId" UUID NOT NULL,
    "steamId64" VARCHAR(20) NOT NULL,
    "personaName" VARCHAR(100) NOT NULL,
    "avatarUrl" VARCHAR(2048),
    "profileUrl" VARCHAR(2048),
    "linkedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastSyncAt" TIMESTAMP(3),

    CONSTRAINT "SteamAccount_pkey" PRIMARY KEY ("userId")
);

-- CreateTable
CREATE TABLE "SteamAppCache" (
    "appId" INTEGER NOT NULL,
    "found" BOOLEAN NOT NULL DEFAULT true,
    "type" VARCHAR(30),
    "data" JSONB NOT NULL DEFAULT '{}',
    "fetchedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SteamAppCache_pkey" PRIMARY KEY ("appId")
);

-- CreateTable
CREATE TABLE "SteamIgnoredApp" (
    "userId" UUID NOT NULL,
    "appId" INTEGER NOT NULL,
    "title" VARCHAR(160) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SteamIgnoredApp_pkey" PRIMARY KEY ("userId","appId")
);

-- CreateTable
CREATE TABLE "SteamSyncJob" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "kind" VARCHAR(20) NOT NULL,
    "status" "SteamJobStatus" NOT NULL DEFAULT 'PENDING',
    "total" INTEGER NOT NULL DEFAULT 0,
    "processed" INTEGER NOT NULL DEFAULT 0,
    "failed" INTEGER NOT NULL DEFAULT 0,
    "options" JSONB NOT NULL DEFAULT '{}',
    "summary" JSONB NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "startedAt" TIMESTAMP(3),
    "finishedAt" TIMESTAMP(3),
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SteamSyncJob_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SteamSyncJobItem" (
    "id" UUID NOT NULL,
    "jobId" UUID NOT NULL,
    "gameId" UUID NOT NULL,
    "appId" INTEGER NOT NULL,
    "mode" VARCHAR(20) NOT NULL DEFAULT 'ENRICH',
    "status" "SteamJobItemStatus" NOT NULL DEFAULT 'PENDING',
    "error" VARCHAR(300),

    CONSTRAINT "SteamSyncJobItem_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "SteamAccount_steamId64_idx" ON "SteamAccount"("steamId64");

-- CreateIndex
CREATE INDEX "SteamAppCache_fetchedAt_idx" ON "SteamAppCache"("fetchedAt");

-- CreateIndex
CREATE INDEX "SteamSyncJob_userId_createdAt_idx" ON "SteamSyncJob"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "SteamSyncJob_status_idx" ON "SteamSyncJob"("status");

-- CreateIndex
CREATE INDEX "SteamSyncJobItem_jobId_status_idx" ON "SteamSyncJobItem"("jobId", "status");

-- CreateIndex
CREATE INDEX "Game_ownerId_source_idx" ON "Game"("ownerId", "source");

-- AddForeignKey
ALTER TABLE "SteamAccount" ADD CONSTRAINT "SteamAccount_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SteamIgnoredApp" ADD CONSTRAINT "SteamIgnoredApp_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SteamSyncJob" ADD CONSTRAINT "SteamSyncJob_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SteamSyncJobItem" ADD CONSTRAINT "SteamSyncJobItem_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "SteamSyncJob"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- ---------------------------------------------------------------------------
-- Restrições escritas à mão (o Prisma não as expressa). Os CHECKs e índices
-- parciais das migrações anteriores continuam valendo e NÃO são tocados.
-- ---------------------------------------------------------------------------

-- Um app da Steam aparece no máximo uma vez na biblioteca de cada dono.
CREATE UNIQUE INDEX "Game_one_steam_app_per_owner" ON "Game"("ownerId", "steamAppId") WHERE "steamAppId" IS NOT NULL;

ALTER TABLE "Game" ADD CONSTRAINT "Game_steam_app_positive" CHECK ("steamAppId" IS NULL OR "steamAppId" > 0);
ALTER TABLE "Game" ADD CONSTRAINT "Game_steam_playtime_non_negative" CHECK ("steamPlaytimeMinutes" IS NULL OR "steamPlaytimeMinutes" >= 0);
ALTER TABLE "Game" ADD CONSTRAINT "Game_steam_achievements_valid" CHECK (
  ("steamAchievementsUnlocked" IS NULL OR "steamAchievementsUnlocked" >= 0)
  AND ("steamAchievementsTotal" IS NULL OR "steamAchievementsTotal" >= 0)
  AND ("steamAchievementsUnlocked" IS NULL OR "steamAchievementsTotal" IS NULL OR "steamAchievementsUnlocked" <= "steamAchievementsTotal")
);
ALTER TABLE "Game" ADD CONSTRAINT "Game_metacritic_range" CHECK ("metacriticScore" IS NULL OR "metacriticScore" BETWEEN 0 AND 100);

ALTER TABLE "SteamAccount" ADD CONSTRAINT "SteamAccount_steamId64_format" CHECK ("steamId64" ~ '^[0-9]{17}$');
ALTER TABLE "SteamAppCache" ADD CONSTRAINT "SteamAppCache_appId_positive" CHECK ("appId" > 0);
ALTER TABLE "SteamIgnoredApp" ADD CONSTRAINT "SteamIgnoredApp_appId_positive" CHECK ("appId" > 0);
ALTER TABLE "SteamSyncJob" ADD CONSTRAINT "SteamSyncJob_counters_valid" CHECK (
  "total" >= 0 AND "processed" >= 0 AND "failed" >= 0 AND "processed" <= "total" AND "failed" <= "processed"
);
ALTER TABLE "SteamSyncJobItem" ADD CONSTRAINT "SteamSyncJobItem_appId_positive" CHECK ("appId" > 0);
