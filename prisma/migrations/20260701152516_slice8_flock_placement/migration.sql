-- CreateEnum
CREATE TYPE "FlockStatus" AS ENUM ('ACTIVE', 'ENDED');

-- CreateEnum
CREATE TYPE "PlacementStatus" AS ENUM ('ACTIVE', 'ENDED');

-- CreateTable
CREATE TABLE "Flock" (
    "id" TEXT NOT NULL,
    "strain" TEXT NOT NULL,
    "chickInDate" DATE NOT NULL,
    "placementAge" INTEGER NOT NULL,
    "status" "FlockStatus" NOT NULL DEFAULT 'ACTIVE',
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Flock_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Placement" (
    "id" TEXT NOT NULL,
    "flockId" TEXT NOT NULL,
    "farmhouseId" TEXT NOT NULL,
    "populasiAwal" INTEGER NOT NULL,
    "startDate" DATE NOT NULL,
    "endDate" DATE,
    "status" "PlacementStatus" NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Placement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "HidupSnapshot" (
    "id" TEXT NOT NULL,
    "placementId" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "mati" INTEGER NOT NULL DEFAULT 0,
    "afkir" INTEGER NOT NULL DEFAULT 0,
    "hidup" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "HidupSnapshot_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Placement_farmhouseId_status_idx" ON "Placement"("farmhouseId", "status");

-- CreateIndex
CREATE INDEX "Placement_flockId_idx" ON "Placement"("flockId");

-- CreateIndex
CREATE INDEX "HidupSnapshot_placementId_date_idx" ON "HidupSnapshot"("placementId", "date");

-- CreateIndex
CREATE UNIQUE INDEX "HidupSnapshot_placementId_date_key" ON "HidupSnapshot"("placementId", "date");

-- AddForeignKey
ALTER TABLE "Flock" ADD CONSTRAINT "Flock_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Placement" ADD CONSTRAINT "Placement_flockId_fkey" FOREIGN KEY ("flockId") REFERENCES "Flock"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Placement" ADD CONSTRAINT "Placement_farmhouseId_fkey" FOREIGN KEY ("farmhouseId") REFERENCES "Farmhouse"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HidupSnapshot" ADD CONSTRAINT "HidupSnapshot_placementId_fkey" FOREIGN KEY ("placementId") REFERENCES "Placement"("id") ON DELETE CASCADE ON UPDATE CASCADE;
