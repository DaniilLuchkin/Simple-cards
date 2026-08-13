-- AlterTable
ALTER TABLE "User" ADD COLUMN     "referredById" TEXT;

-- CreateIndex
CREATE INDEX "User_referredById_idx" ON "User"("referredById");
