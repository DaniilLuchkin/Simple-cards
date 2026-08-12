-- AlterTable
ALTER TABLE "User" ADD COLUMN     "currentLevel" TEXT NOT NULL DEFAULT 'A0',
ADD COLUMN     "targetLevel" TEXT NOT NULL DEFAULT 'B1',
ADD COLUMN     "showMilestones" BOOLEAN NOT NULL DEFAULT true;
