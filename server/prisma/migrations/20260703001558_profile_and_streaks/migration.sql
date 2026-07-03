-- AlterTable
ALTER TABLE "User" ADD COLUMN     "dailyGoal" INTEGER NOT NULL DEFAULT 10,
ADD COLUMN     "learningLanguage" TEXT NOT NULL DEFAULT 'en',
ADD COLUMN     "translationLanguage" TEXT NOT NULL DEFAULT 'ru';

-- CreateTable
CREATE TABLE "ReviewDay" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "day" DATE NOT NULL,
    "count" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "ReviewDay_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ReviewDay_userId_day_key" ON "ReviewDay"("userId", "day");

-- AddForeignKey
ALTER TABLE "ReviewDay" ADD CONSTRAINT "ReviewDay_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
