-- CreateEnum
CREATE TYPE "SizeHealthGrade" AS ENUM ('ANGKAT_RAK', 'A_PLUS_PLUS', 'A_PLUS', 'A', 'B', 'C', 'KECIL', 'MINI', 'RETAK', 'PLASTIK', 'LUNAK');

-- CreateEnum
CREATE TYPE "MovementType" AS ENUM ('IN', 'OUT', 'CORRECTION', 'VOID');

-- CreateEnum
CREATE TYPE "SourceType" AS ENUM ('ANGKAT_RAK', 'GRADING', 'SALES', 'CORRECTION', 'ADJUSTMENT');

-- CreateEnum
CREATE TYPE "RecordStatus" AS ENUM ('ACTIVE', 'INACTIVE');

-- CreateTable
CREATE TABLE "GradeType" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "status" "RecordStatus" NOT NULL DEFAULT 'ACTIVE',
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GradeType_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Warehouse" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "status" "RecordStatus" NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Warehouse_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WarehouseStock" (
    "id" TEXT NOT NULL,
    "warehouseId" TEXT NOT NULL,
    "sizeHealthGrade" "SizeHealthGrade" NOT NULL,
    "typeGradeId" TEXT NOT NULL,
    "currentQuantity" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WarehouseStock_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StockMovement" (
    "id" TEXT NOT NULL,
    "warehouseId" TEXT NOT NULL,
    "sizeHealthGrade" "SizeHealthGrade" NOT NULL,
    "typeGradeId" TEXT NOT NULL,
    "movementType" "MovementType" NOT NULL,
    "quantity" INTEGER NOT NULL,
    "unitUsed" TEXT NOT NULL DEFAULT 'PCS',
    "sourceType" "SourceType" NOT NULL,
    "sourceReferenceId" TEXT,
    "reason" TEXT,
    "preQuantity" INTEGER NOT NULL,
    "postQuantity" INTEGER NOT NULL,
    "date" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "enteredById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StockMovement_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "GradeType_name_key" ON "GradeType"("name");

-- CreateIndex
CREATE UNIQUE INDEX "Warehouse_code_key" ON "Warehouse"("code");

-- CreateIndex
CREATE INDEX "WarehouseStock_warehouseId_idx" ON "WarehouseStock"("warehouseId");

-- CreateIndex
CREATE UNIQUE INDEX "WarehouseStock_warehouseId_sizeHealthGrade_typeGradeId_key" ON "WarehouseStock"("warehouseId", "sizeHealthGrade", "typeGradeId");

-- CreateIndex
CREATE INDEX "StockMovement_warehouseId_date_idx" ON "StockMovement"("warehouseId", "date");

-- CreateIndex
CREATE INDEX "StockMovement_warehouseId_sizeHealthGrade_typeGradeId_idx" ON "StockMovement"("warehouseId", "sizeHealthGrade", "typeGradeId");

-- AddForeignKey
ALTER TABLE "WarehouseStock" ADD CONSTRAINT "WarehouseStock_warehouseId_fkey" FOREIGN KEY ("warehouseId") REFERENCES "Warehouse"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WarehouseStock" ADD CONSTRAINT "WarehouseStock_typeGradeId_fkey" FOREIGN KEY ("typeGradeId") REFERENCES "GradeType"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StockMovement" ADD CONSTRAINT "StockMovement_warehouseId_fkey" FOREIGN KEY ("warehouseId") REFERENCES "Warehouse"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StockMovement" ADD CONSTRAINT "StockMovement_typeGradeId_fkey" FOREIGN KEY ("typeGradeId") REFERENCES "GradeType"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
