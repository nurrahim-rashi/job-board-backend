-- Preserve all existing location data as Indonesian while allowing future
-- postings and companies to be filtered by their full location hierarchy.
ALTER TABLE "companies"
  ADD COLUMN "province" TEXT,
  ADD COLUMN "country" TEXT NOT NULL DEFAULT 'Indonesia';

ALTER TABLE "job_postings"
  ADD COLUMN "provinceLocation" TEXT,
  ADD COLUMN "countryLocation" TEXT NOT NULL DEFAULT 'Indonesia';

UPDATE "companies" AS company
SET "province" = owner."province"
FROM "users" AS owner
WHERE company."userId" = owner."id"
  AND owner."province" IS NOT NULL;

UPDATE "job_postings" AS job
SET "provinceLocation" = company."province",
    "countryLocation" = company."country"
FROM "companies" AS company
WHERE job."companyId" = company."id";
