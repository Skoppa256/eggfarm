-- CreateEnum
CREATE TYPE "SalesStatus" AS ENUM ('ACTIVE', 'VOIDED');

-- CreateTable
CREATE TABLE "Buyer" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "status" "RecordStatus" NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Buyer_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SalesTransaction" (
    "id" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "warehouseId" TEXT NOT NULL,
    "buyerId" TEXT NOT NULL,
    "status" "SalesStatus" NOT NULL DEFAULT 'ACTIVE',
    "notes" TEXT,
    "voidReason" TEXT,
    "voidedById" TEXT,
    "voidedAt" TIMESTAMP(3),
    "enteredById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SalesTransaction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SalesLineItem" (
    "id" TEXT NOT NULL,
    "transactionId" TEXT NOT NULL,
    "sizeHealthGrade" "SizeHealthGrade" NOT NULL,
    "typeGradeId" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL,
    "unitUsed" TEXT NOT NULL,

    CONSTRAINT "SalesLineItem_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "SalesTransaction_warehouseId_date_idx" ON "SalesTransaction"("warehouseId", "date");

-- CreateIndex
CREATE INDEX "SalesTransaction_buyerId_date_idx" ON "SalesTransaction"("buyerId", "date");

-- CreateIndex
CREATE INDEX "SalesLineItem_transactionId_idx" ON "SalesLineItem"("transactionId");

-- AddForeignKey
ALTER TABLE "SalesTransaction" ADD CONSTRAINT "SalesTransaction_warehouseId_fkey" FOREIGN KEY ("warehouseId") REFERENCES "Warehouse"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SalesTransaction" ADD CONSTRAINT "SalesTransaction_buyerId_fkey" FOREIGN KEY ("buyerId") REFERENCES "Buyer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SalesTransaction" ADD CONSTRAINT "SalesTransaction_enteredById_fkey" FOREIGN KEY ("enteredById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SalesTransaction" ADD CONSTRAINT "SalesTransaction_voidedById_fkey" FOREIGN KEY ("voidedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SalesLineItem" ADD CONSTRAINT "SalesLineItem_transactionId_fkey" FOREIGN KEY ("transactionId") REFERENCES "SalesTransaction"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SalesLineItem" ADD CONSTRAINT "SalesLineItem_typeGradeId_fkey" FOREIGN KEY ("typeGradeId") REFERENCES "GradeType"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
