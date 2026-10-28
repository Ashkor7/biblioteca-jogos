-- CreateEnum
CREATE TYPE "OwnershipStatus" AS ENUM ('OWNED', 'WISHLIST');

-- CreateEnum
CREATE TYPE "MediaType" AS ENUM ('PHYSICAL', 'DIGITAL');

-- CreateEnum
CREATE TYPE "PlayStatus" AS ENUM ('NOT_STARTED', 'COMPLETED', 'ABANDONED');

-- CreateTable
CREATE TABLE "User" (
    "id" UUID NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Platform" (
    "id" UUID NOT NULL,
    "name" VARCHAR(60) NOT NULL,
    "normalizedName" VARCHAR(60) NOT NULL,
    "slug" VARCHAR(80) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Platform_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PlatformSlugAlias" (
    "slug" VARCHAR(80) NOT NULL,
    "platformId" UUID NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PlatformSlugAlias_pkey" PRIMARY KEY ("slug")
);

-- CreateTable
CREATE TABLE "Store" (
    "id" UUID NOT NULL,
    "name" VARCHAR(60) NOT NULL,
    "normalizedName" VARCHAR(60) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Store_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Category" (
    "id" UUID NOT NULL,
    "name" VARCHAR(40) NOT NULL,
    "normalizedName" VARCHAR(40) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Category_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Game" (
    "id" UUID NOT NULL,
    "ownerId" UUID NOT NULL,
    "title" VARCHAR(160) NOT NULL,
    "platformId" UUID NOT NULL,
    "ownershipStatus" "OwnershipStatus" NOT NULL,
    "mediaType" "MediaType",
    "originalPrice" DECIMAL(12,2),
    "paidPrice" DECIMAL(12,2),
    "currentWishPrice" DECIMAL(12,2),
    "wishPriceUpdatedAt" TIMESTAMP(3),
    "storeId" UUID,
    "purchasedAt" TIMESTAMP(3),
    "playStatus" "PlayStatus" NOT NULL DEFAULT 'NOT_STARTED',
    "playTimeMinutes" INTEGER NOT NULL DEFAULT 0,
    "ratingStars" SMALLINT,
    "reviewText" TEXT,
    "isFeatured" BOOLEAN NOT NULL DEFAULT false,
    "needsReview" BOOLEAN NOT NULL DEFAULT false,
    "legacyId" VARCHAR(64),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Game_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GameCategory" (
    "gameId" UUID NOT NULL,
    "categoryId" UUID NOT NULL,

    CONSTRAINT "GameCategory_pkey" PRIMARY KEY ("gameId","categoryId")
);

-- CreateTable
CREATE TABLE "GameImage" (
    "id" UUID NOT NULL,
    "gameId" UUID NOT NULL,
    "url" VARCHAR(2048) NOT NULL,
    "storageKey" VARCHAR(80),
    "mimeType" VARCHAR(40),
    "sizeBytes" INTEGER,
    "altText" VARCHAR(200),
    "isCover" BOOLEAN NOT NULL DEFAULT false,
    "position" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "GameImage_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "Platform_normalizedName_key" ON "Platform"("normalizedName");

-- CreateIndex
CREATE UNIQUE INDEX "Platform_slug_key" ON "Platform"("slug");

-- CreateIndex
CREATE INDEX "PlatformSlugAlias_platformId_idx" ON "PlatformSlugAlias"("platformId");

-- CreateIndex
CREATE UNIQUE INDEX "Store_normalizedName_key" ON "Store"("normalizedName");

-- CreateIndex
CREATE UNIQUE INDEX "Category_normalizedName_key" ON "Category"("normalizedName");

-- CreateIndex
CREATE INDEX "Game_ownerId_ownershipStatus_idx" ON "Game"("ownerId", "ownershipStatus");

-- CreateIndex
CREATE INDEX "Game_platformId_idx" ON "Game"("platformId");

-- CreateIndex
CREATE INDEX "Game_storeId_idx" ON "Game"("storeId");

-- CreateIndex
CREATE INDEX "Game_ownerId_title_idx" ON "Game"("ownerId", "title");

-- CreateIndex
CREATE UNIQUE INDEX "Game_ownerId_legacyId_key" ON "Game"("ownerId", "legacyId");

-- CreateIndex
CREATE INDEX "GameCategory_categoryId_idx" ON "GameCategory"("categoryId");

-- CreateIndex
CREATE UNIQUE INDEX "GameImage_storageKey_key" ON "GameImage"("storageKey");

-- CreateIndex
CREATE INDEX "GameImage_gameId_position_idx" ON "GameImage"("gameId", "position");

-- AddForeignKey
ALTER TABLE "PlatformSlugAlias" ADD CONSTRAINT "PlatformSlugAlias_platformId_fkey" FOREIGN KEY ("platformId") REFERENCES "Platform"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Game" ADD CONSTRAINT "Game_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Game" ADD CONSTRAINT "Game_platformId_fkey" FOREIGN KEY ("platformId") REFERENCES "Platform"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Game" ADD CONSTRAINT "Game_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "Store"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GameCategory" ADD CONSTRAINT "GameCategory_gameId_fkey" FOREIGN KEY ("gameId") REFERENCES "Game"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GameCategory" ADD CONSTRAINT "GameCategory_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "Category"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GameImage" ADD CONSTRAINT "GameImage_gameId_fkey" FOREIGN KEY ("gameId") REFERENCES "Game"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- ---------------------------------------------------------------------------
-- Restrições adicionais (não expressáveis no schema.prisma)
-- ---------------------------------------------------------------------------

-- Valores monetários e horas nunca negativos; nota de 1 a 5.
ALTER TABLE "Game" ADD CONSTRAINT "Game_prices_non_negative" CHECK (
  ("originalPrice" IS NULL OR "originalPrice" >= 0) AND
  ("paidPrice" IS NULL OR "paidPrice" >= 0) AND
  ("currentWishPrice" IS NULL OR "currentWishPrice" >= 0)
);
ALTER TABLE "Game" ADD CONSTRAINT "Game_playTime_non_negative" CHECK ("playTimeMinutes" >= 0);
ALTER TABLE "Game" ADD CONSTRAINT "Game_rating_range" CHECK ("ratingStars" IS NULL OR "ratingStars" BETWEEN 1 AND 5);

-- Item da lista de desejos não tem dados de compra.
ALTER TABLE "Game" ADD CONSTRAINT "Game_wishlist_without_purchase" CHECK (
  "ownershipStatus" = 'OWNED' OR ("paidPrice" IS NULL AND "storeId" IS NULL AND "mediaType" IS NULL)
);

-- No máximo uma capa por jogo e um jogo em destaque por proprietário.
CREATE UNIQUE INDEX "GameImage_one_cover_per_game" ON "GameImage"("gameId") WHERE "isCover";
CREATE UNIQUE INDEX "Game_one_featured_per_owner" ON "Game"("ownerId") WHERE "isFeatured";
