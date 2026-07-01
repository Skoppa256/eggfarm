-- CreateTable
CREATE TABLE "CollectionRecord" (
    "id" TEXT NOT NULL,
    "farmhouseId" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "batchNumber" INTEGER NOT NULL,
    "goodEggs" INTEGER NOT NULL DEFAULT 0,
    "telurRetak" INTEGER NOT NULL DEFAULT 0,
    "telurLunak" INTEGER NOT NULL DEFAULT 0,
    "telurKosong" INTEGER NOT NULL DEFAULT 0,
    "remarks" TEXT,
    "maxBatchesAtEntry" INTEGER NOT NULL,
    "enteredById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CollectionRecord_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AngkatRakLift" (
    "id" TEXT NOT NULL,
    "collectionRecordId" TEXT NOT NULL,
    "typeGradeId" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL,

    CONSTRAINT "AngkatRakLift_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "CollectionRecord_farmhouseId_date_idx" ON "CollectionRecord"("farmhouseId", "date");

-- CreateIndex
CREATE UNIQUE INDEX "CollectionRecord_farmhouseId_date_batchNumber_key" ON "CollectionRecord"("farmhouseId", "date", "batchNumber");

-- CreateIndex
CREATE UNIQUE INDEX "AngkatRakLift_collectionRecordId_typeGradeId_key" ON "AngkatRakLift"("collectionRecordId", "typeGradeId");

-- AddForeignKey
ALTER TABLE "CollectionRecord" ADD CONSTRAINT "CollectionRecord_farmhouseId_fkey" FOREIGN KEY ("farmhouseId") REFERENCES "Farmhouse"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CollectionRecord" ADD CONSTRAINT "CollectionRecord_enteredById_fkey" FOREIGN KEY ("enteredById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AngkatRakLift" ADD CONSTRAINT "AngkatRakLift_collectionRecordId_fkey" FOREIGN KEY ("collectionRecordId") REFERENCES "CollectionRecord"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AngkatRakLift" ADD CONSTRAINT "AngkatRakLift_typeGradeId_fkey" FOREIGN KEY ("typeGradeId") REFERENCES "GradeType"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
