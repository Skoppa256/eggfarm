-- CreateEnum
CREATE TYPE "GradingStatus" AS ENUM ('DRAFT', 'SUBMITTED');

-- CreateTable
CREATE TABLE "GradingRecord" (
    "id" TEXT NOT NULL,
    "farmhouseId" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "batchNumber" INTEGER NOT NULL,
    "status" "GradingStatus" NOT NULL DEFAULT 'DRAFT',
    "linkedCollectionId" TEXT,
    "remarks" TEXT,
    "enteredById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GradingRecord_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GradingLineItem" (
    "id" TEXT NOT NULL,
    "gradingRecordId" TEXT NOT NULL,
    "sizeHealthGrade" "SizeHealthGrade" NOT NULL,
    "typeGradeId" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL,

    CONSTRAINT "GradingLineItem_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "GradingRecord_farmhouseId_date_idx" ON "GradingRecord"("farmhouseId", "date");

-- CreateIndex
CREATE UNIQUE INDEX "GradingRecord_farmhouseId_date_batchNumber_key" ON "GradingRecord"("farmhouseId", "date", "batchNumber");

-- CreateIndex
CREATE UNIQUE INDEX "GradingLineItem_gradingRecordId_sizeHealthGrade_typeGradeId_key" ON "GradingLineItem"("gradingRecordId", "sizeHealthGrade", "typeGradeId");

-- AddForeignKey
ALTER TABLE "GradingRecord" ADD CONSTRAINT "GradingRecord_farmhouseId_fkey" FOREIGN KEY ("farmhouseId") REFERENCES "Farmhouse"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GradingRecord" ADD CONSTRAINT "GradingRecord_enteredById_fkey" FOREIGN KEY ("enteredById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GradingRecord" ADD CONSTRAINT "GradingRecord_linkedCollectionId_fkey" FOREIGN KEY ("linkedCollectionId") REFERENCES "CollectionRecord"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GradingLineItem" ADD CONSTRAINT "GradingLineItem_gradingRecordId_fkey" FOREIGN KEY ("gradingRecordId") REFERENCES "GradingRecord"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GradingLineItem" ADD CONSTRAINT "GradingLineItem_typeGradeId_fkey" FOREIGN KEY ("typeGradeId") REFERENCES "GradeType"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
