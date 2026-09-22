-- The app only ever soft-deletes a job posting (deletedAt), so this only
-- matters for cleanup scripts and tests that hard-delete a JobPosting row.
-- A bookmark should just disappear along with the thing it bookmarked,
-- not block the delete the way an application record correctly does.
-- DropForeignKey
ALTER TABLE "saved_jobs" DROP CONSTRAINT "saved_jobs_jobId_fkey";

-- AddForeignKey
ALTER TABLE "saved_jobs" ADD CONSTRAINT "saved_jobs_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "job_postings"("id") ON DELETE CASCADE ON UPDATE CASCADE;
