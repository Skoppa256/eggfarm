-- CreateEnum
CREATE TYPE "OvkCategory" AS ENUM ('OBAT', 'VITAMIN', 'CHEMICAL');

-- CreateEnum
CREATE TYPE "OvkSourceType" AS ENUM ('DELIVERY', 'TRANSFER', 'CORRECTION');

-- CreateTable
CREATE TABLE "OvkItem" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "category" "OvkCategory" NOT NULL,
    "baseUnit" TEXT NOT NULL,
    "status" "RecordStatus" NOT NULL DEFAULT 'ACTIVE',
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OvkItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OvkUnitConversion" (
    "id" TEXT NOT NULL,
    "ovkItemId" TEXT NOT NULL,
    "unitName" TEXT NOT NULL,
    "factorToBase" DECIMAL(14,4) NOT NULL,

    CONSTRAINT "OvkUnitConversion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OvkStock" (
    "id" TEXT NOT NULL,
    "ovkItemId" TEXT NOT NULL,
    "currentQuantity" DECIMAL(14,3) NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OvkStock_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OvkMovement" (
    "id" TEXT NOT NULL,
    "ovkItemId" TEXT NOT NULL,
    "movementType" "MovementType" NOT NULL,
    "sourceType" "OvkSourceType" NOT NULL,
    "quantity" DECIMAL(14,3) NOT NULL,
    "enteredQuantity" DECIMAL(14,3) NOT NULL,
    "unitUsed" TEXT NOT NULL,
    "farmhouseId" TEXT,
    "note" TEXT,
    "reason" TEXT,
    "preQuantity" DECIMAL(14,3) NOT NULL,
    "postQuantity" DECIMAL(14,3) NOT NULL,
    "date" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "enteredById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OvkMovement_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "OvkItem_name_key" ON "OvkItem"("name");

-- CreateIndex
CREATE UNIQUE INDEX "OvkUnitConversion_ovkItemId_unitName_key" ON "OvkUnitConversion"("ovkItemId", "unitName");

-- CreateIndex
CREATE UNIQUE INDEX "OvkStock_ovkItemId_key" ON "OvkStock"("ovkItemId");

-- CreateIndex
CREATE INDEX "OvkMovement_ovkItemId_date_idx" ON "OvkMovement"("ovkItemId", "date");

-- CreateIndex
CREATE INDEX "OvkMovement_farmhouseId_date_idx" ON "OvkMovement"("farmhouseId", "date");

-- CreateIndex
CREATE INDEX "OvkMovement_enteredById_idx" ON "OvkMovement"("enteredById");

-- AddForeignKey
ALTER TABLE "OvkUnitConversion" ADD CONSTRAINT "OvkUnitConversion_ovkItemId_fkey" FOREIGN KEY ("ovkItemId") REFERENCES "OvkItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OvkStock" ADD CONSTRAINT "OvkStock_ovkItemId_fkey" FOREIGN KEY ("ovkItemId") REFERENCES "OvkItem"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OvkMovement" ADD CONSTRAINT "OvkMovement_ovkItemId_fkey" FOREIGN KEY ("ovkItemId") REFERENCES "OvkItem"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OvkMovement" ADD CONSTRAINT "OvkMovement_farmhouseId_fkey" FOREIGN KEY ("farmhouseId") REFERENCES "Farmhouse"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OvkMovement" ADD CONSTRAINT "OvkMovement_enteredById_fkey" FOREIGN KEY ("enteredById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
