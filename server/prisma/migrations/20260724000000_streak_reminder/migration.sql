-- AlterTable
ALTER TABLE "User" ADD COLUMN     "reminderEnabled" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "lastReminderAt" TIMESTAMP(3);
