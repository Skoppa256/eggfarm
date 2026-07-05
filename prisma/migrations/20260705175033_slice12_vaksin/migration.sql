-- CreateTable
CREATE TABLE "VaksinType" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "status" "RecordStatus" NOT NULL DEFAULT 'ACTIVE',
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "VaksinType_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VaksinLog" (
    "id" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "vaksinTypeId" TEXT NOT NULL,
    "farmhouseId" TEXT NOT NULL,
    "vials" INTEGER NOT NULL,
    "vaccinator" TEXT NOT NULL,
    "enteredById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "VaksinLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "VaksinType_name_key" ON "VaksinType"("name");

-- CreateIndex
CREATE INDEX "VaksinLog_farmhouseId_date_idx" ON "VaksinLog"("farmhouseId", "date");

-- CreateIndex
CREATE INDEX "VaksinLog_vaksinTypeId_idx" ON "VaksinLog"("vaksinTypeId");

-- CreateIndex
CREATE INDEX "VaksinLog_date_idx" ON "VaksinLog"("date");

-- AddForeignKey
ALTER TABLE "VaksinLog" ADD CONSTRAINT "VaksinLog_vaksinTypeId_fkey" FOREIGN KEY ("vaksinTypeId") REFERENCES "VaksinType"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VaksinLog" ADD CONSTRAINT "VaksinLog_farmhouseId_fkey" FOREIGN KEY ("farmhouseId") REFERENCES "Farmhouse"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VaksinLog" ADD CONSTRAINT "VaksinLog_enteredById_fkey" FOREIGN KEY ("enteredById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
