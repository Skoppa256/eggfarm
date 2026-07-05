-- CreateEnum
CREATE TYPE "IngredientCategory" AS ENUM ('KONSENTRAT', 'PREMIX', 'GRAIN', 'BRAN');

-- CreateEnum
CREATE TYPE "IngredientSourceType" AS ENUM ('DELIVERY', 'MIXING', 'CORRECTION');

-- CreateEnum
CREATE TYPE "MixLineKind" AS ENUM ('MAIN_PERCENT', 'FIXED_WEIGHT');

-- AlterTable
ALTER TABLE "DailyRecord" ADD COLUMN     "fcr" DECIMAL(10,3),
ADD COLUMN     "gramPerEkor" DECIMAL(10,2),
ADD COLUMN     "jenis" TEXT,
ADD COLUMN     "pakanMasuk" DECIMAL(12,3),
ADD COLUMN     "pakanTersedia" DECIMAL(12,3),
ADD COLUMN     "realisasiIntake" DECIMAL(12,3),
ADD COLUMN     "reusableLeftoverIn" DECIMAL(12,3);

-- CreateTable
CREATE TABLE "Ingredient" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "category" "IngredientCategory" NOT NULL,
    "baseUnit" TEXT NOT NULL DEFAULT 'kg',
    "status" "RecordStatus" NOT NULL DEFAULT 'ACTIVE',
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Ingredient_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "IngredientStock" (
    "id" TEXT NOT NULL,
    "ingredientId" TEXT NOT NULL,
    "currentQuantity" DECIMAL(12,3) NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "IngredientStock_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "IngredientMovement" (
    "id" TEXT NOT NULL,
    "ingredientId" TEXT NOT NULL,
    "movementType" "MovementType" NOT NULL,
    "quantity" DECIMAL(12,3) NOT NULL,
    "sourceType" "IngredientSourceType" NOT NULL,
    "sourceReferenceId" TEXT,
    "reason" TEXT,
    "preQuantity" DECIMAL(12,3) NOT NULL,
    "postQuantity" DECIMAL(12,3) NOT NULL,
    "date" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "enteredById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "IngredientMovement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MixingRecord" (
    "id" TEXT NOT NULL,
    "farmhouseId" TEXT NOT NULL,
    "placementId" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "projectedIntake" DECIMAL(10,3) NOT NULL,
    "hidupAtMix" INTEGER NOT NULL,
    "requirement" DECIMAL(12,3) NOT NULL,
    "reusableLeftover" DECIMAL(12,3) NOT NULL,
    "totalCampur" DECIMAL(12,3) NOT NULL,
    "jenis" TEXT NOT NULL,
    "enteredById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MixingRecord_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MixingLine" (
    "id" TEXT NOT NULL,
    "mixingRecordId" TEXT NOT NULL,
    "ingredientId" TEXT NOT NULL,
    "kind" "MixLineKind" NOT NULL,
    "percent" DECIMAL(6,3),
    "fixedWeight" DECIMAL(12,3),
    "computedWeight" DECIMAL(12,3) NOT NULL,

    CONSTRAINT "MixingLine_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Ingredient_name_key" ON "Ingredient"("name");

-- CreateIndex
CREATE UNIQUE INDEX "IngredientStock_ingredientId_key" ON "IngredientStock"("ingredientId");

-- CreateIndex
CREATE INDEX "IngredientMovement_ingredientId_date_idx" ON "IngredientMovement"("ingredientId", "date");

-- CreateIndex
CREATE INDEX "IngredientMovement_enteredById_idx" ON "IngredientMovement"("enteredById");

-- CreateIndex
CREATE INDEX "MixingRecord_placementId_date_idx" ON "MixingRecord"("placementId", "date");

-- CreateIndex
CREATE UNIQUE INDEX "MixingRecord_farmhouseId_date_key" ON "MixingRecord"("farmhouseId", "date");

-- CreateIndex
CREATE INDEX "MixingLine_mixingRecordId_idx" ON "MixingLine"("mixingRecordId");

-- AddForeignKey
ALTER TABLE "IngredientStock" ADD CONSTRAINT "IngredientStock_ingredientId_fkey" FOREIGN KEY ("ingredientId") REFERENCES "Ingredient"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IngredientMovement" ADD CONSTRAINT "IngredientMovement_ingredientId_fkey" FOREIGN KEY ("ingredientId") REFERENCES "Ingredient"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IngredientMovement" ADD CONSTRAINT "IngredientMovement_enteredById_fkey" FOREIGN KEY ("enteredById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MixingRecord" ADD CONSTRAINT "MixingRecord_farmhouseId_fkey" FOREIGN KEY ("farmhouseId") REFERENCES "Farmhouse"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MixingRecord" ADD CONSTRAINT "MixingRecord_placementId_fkey" FOREIGN KEY ("placementId") REFERENCES "Placement"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MixingRecord" ADD CONSTRAINT "MixingRecord_enteredById_fkey" FOREIGN KEY ("enteredById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MixingLine" ADD CONSTRAINT "MixingLine_mixingRecordId_fkey" FOREIGN KEY ("mixingRecordId") REFERENCES "MixingRecord"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MixingLine" ADD CONSTRAINT "MixingLine_ingredientId_fkey" FOREIGN KEY ("ingredientId") REFERENCES "Ingredient"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
