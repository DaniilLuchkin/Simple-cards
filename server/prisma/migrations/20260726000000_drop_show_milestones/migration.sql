-- Milestones are now plain word counts shown to everyone, so the per-user
-- visibility flag is no longer used.
ALTER TABLE "User" DROP COLUMN IF EXISTS "showMilestones";
