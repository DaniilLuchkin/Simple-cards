-- AlterTable
ALTER TABLE "Card" ADD COLUMN     "collocations" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "forms" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "ipa" TEXT,
ADD COLUMN     "lapses" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "personalNote" TEXT NOT NULL DEFAULT '',
ADD COLUMN     "pos" TEXT,
ADD COLUMN     "sentence" TEXT;
