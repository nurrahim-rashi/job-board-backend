ALTER TABLE "job_applications"
ADD COLUMN "lastEducationSnapshot" TEXT;

UPDATE "job_applications" AS application
SET "lastEducationSnapshot" = users."lastEducation"
FROM "users" AS users
WHERE application."userId" = users."id"
  AND application."lastEducationSnapshot" IS NULL;
