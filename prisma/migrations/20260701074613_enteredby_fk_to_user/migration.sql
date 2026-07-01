/*
  Warnings:

  - Made the column `enteredById` on table `StockMovement` required. This step will fail if there are existing NULL values in that column.

*/
-- AlterTable
ALTER TABLE "StockMovement" ALTER COLUMN "enteredById" SET NOT NULL;

-- CreateIndex
CREATE INDEX "StockMovement_enteredById_idx" ON "StockMovement"("enteredById");

-- AddForeignKey
ALTER TABLE "StockMovement" ADD CONSTRAINT "StockMovement_enteredById_fkey" FOREIGN KEY ("enteredById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
