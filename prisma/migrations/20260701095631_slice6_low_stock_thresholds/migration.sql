-- CreateTable
CREATE TABLE "LowStockThreshold" (
    "id" TEXT NOT NULL,
    "warehouseId" TEXT NOT NULL,
    "sizeHealthGrade" "SizeHealthGrade" NOT NULL,
    "typeGradeId" TEXT NOT NULL,
    "minQuantity" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LowStockThreshold_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "LowStockThreshold_warehouseId_idx" ON "LowStockThreshold"("warehouseId");

-- CreateIndex
CREATE UNIQUE INDEX "LowStockThreshold_warehouseId_sizeHealthGrade_typeGradeId_key" ON "LowStockThreshold"("warehouseId", "sizeHealthGrade", "typeGradeId");

-- AddForeignKey
ALTER TABLE "LowStockThreshold" ADD CONSTRAINT "LowStockThreshold_warehouseId_fkey" FOREIGN KEY ("warehouseId") REFERENCES "Warehouse"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LowStockThreshold" ADD CONSTRAINT "LowStockThreshold_typeGradeId_fkey" FOREIGN KEY ("typeGradeId") REFERENCES "GradeType"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
