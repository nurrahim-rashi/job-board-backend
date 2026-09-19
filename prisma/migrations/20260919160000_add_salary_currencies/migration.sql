ALTER TABLE "users"
ADD COLUMN "salaryExpectationCurrency" VARCHAR(3) NOT NULL DEFAULT 'IDR';

ALTER TABLE "job_postings"
ADD COLUMN "salaryCurrency" VARCHAR(3) NOT NULL DEFAULT 'IDR';

ALTER TABLE "job_applications"
ADD COLUMN "expectedSalaryCurrency" VARCHAR(3) NOT NULL DEFAULT 'IDR';

ALTER TABLE "company_reviews"
ADD COLUMN "salaryCurrency" VARCHAR(3) NOT NULL DEFAULT 'IDR';
