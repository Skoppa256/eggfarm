-- CreateTable
CREATE TABLE "DailyRecord" (
    "id" TEXT NOT NULL,
    "farmhouseId" TEXT NOT NULL,
    "placementId" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "mati" INTEGER NOT NULL DEFAULT 0,
    "afkir" INTEGER NOT NULL DEFAULT 0,
    "sisaDigunakan" DECIMAL(10,3) NOT NULL DEFAULT 0,
    "sisaDibuang" DECIMAL(10,3) NOT NULL DEFAULT 0,
    "beratTelur" DECIMAL(10,3) NOT NULL DEFAULT 0,
    "beratBadan" DECIMAL(10,2),
    "obatNote" TEXT,
    "vitaminNote" TEXT,
    "keterangan" TEXT,
    "hidup" INTEGER NOT NULL,
    "hdPercent" DECIMAL(6,2) NOT NULL,
    "enteredById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DailyRecord_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "DailyRecord_placementId_date_idx" ON "DailyRecord"("placementId", "date");

-- CreateIndex
CREATE INDEX "DailyRecord_farmhouseId_date_idx" ON "DailyRecord"("farmhouseId", "date");

-- CreateIndex
CREATE UNIQUE INDEX "DailyRecord_farmhouseId_date_key" ON "DailyRecord"("farmhouseId", "date");

-- AddForeignKey
ALTER TABLE "DailyRecord" ADD CONSTRAINT "DailyRecord_farmhouseId_fkey" FOREIGN KEY ("farmhouseId") REFERENCES "Farmhouse"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DailyRecord" ADD CONSTRAINT "DailyRecord_placementId_fkey" FOREIGN KEY ("placementId") REFERENCES "Placement"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DailyRecord" ADD CONSTRAINT "DailyRecord_enteredById_fkey" FOREIGN KEY ("enteredById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
