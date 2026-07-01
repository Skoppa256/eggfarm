-- CreateTable
CREATE TABLE "Farmhouse" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "status" "RecordStatus" NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Farmhouse_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FarmhouseWarehouseMapping" (
    "id" TEXT NOT NULL,
    "farmhouseId" TEXT NOT NULL,
    "warehouseId" TEXT NOT NULL,
    "effectiveFrom" DATE NOT NULL,
    "changedById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FarmhouseWarehouseMapping_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FarmhouseBatchSetting" (
    "id" TEXT NOT NULL,
    "farmhouseId" TEXT NOT NULL,
    "maxBatchesPerDay" INTEGER NOT NULL,
    "effectiveFrom" DATE NOT NULL,
    "changedById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FarmhouseBatchSetting_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MeasurementUnit" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "pcsEquivalent" INTEGER NOT NULL,
    "status" "RecordStatus" NOT NULL DEFAULT 'ACTIVE',
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MeasurementUnit_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Farmhouse_code_key" ON "Farmhouse"("code");

-- CreateIndex
CREATE INDEX "FarmhouseWarehouseMapping_farmhouseId_effectiveFrom_idx" ON "FarmhouseWarehouseMapping"("farmhouseId", "effectiveFrom");

-- CreateIndex
CREATE INDEX "FarmhouseBatchSetting_farmhouseId_effectiveFrom_idx" ON "FarmhouseBatchSetting"("farmhouseId", "effectiveFrom");

-- CreateIndex
CREATE UNIQUE INDEX "MeasurementUnit_name_key" ON "MeasurementUnit"("name");

-- AddForeignKey
ALTER TABLE "FarmhouseWarehouseMapping" ADD CONSTRAINT "FarmhouseWarehouseMapping_farmhouseId_fkey" FOREIGN KEY ("farmhouseId") REFERENCES "Farmhouse"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FarmhouseWarehouseMapping" ADD CONSTRAINT "FarmhouseWarehouseMapping_warehouseId_fkey" FOREIGN KEY ("warehouseId") REFERENCES "Warehouse"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FarmhouseWarehouseMapping" ADD CONSTRAINT "FarmhouseWarehouseMapping_changedById_fkey" FOREIGN KEY ("changedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FarmhouseBatchSetting" ADD CONSTRAINT "FarmhouseBatchSetting_farmhouseId_fkey" FOREIGN KEY ("farmhouseId") REFERENCES "Farmhouse"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FarmhouseBatchSetting" ADD CONSTRAINT "FarmhouseBatchSetting_changedById_fkey" FOREIGN KEY ("changedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
