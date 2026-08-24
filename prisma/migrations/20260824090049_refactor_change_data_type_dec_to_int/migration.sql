/*
  Warnings:

  - You are about to alter the column `score` on the `applicant_test_results` table. The data in that column could be lost. The data in that column will be cast from `Decimal(5,2)` to `Integer`.
  - You are about to alter the column `salaryEstimate` on the `company_reviews` table. The data in that column could be lost. The data in that column will be cast from `Decimal(15,2)` to `Integer`.
  - You are about to alter the column `expectedSalary` on the `job_applications` table. The data in that column could be lost. The data in that column will be cast from `Decimal(15,2)` to `Integer`.
  - You are about to alter the column `salaryMin` on the `job_postings` table. The data in that column could be lost. The data in that column will be cast from `Decimal(15,2)` to `Integer`.
  - You are about to alter the column `salaryMax` on the `job_postings` table. The data in that column could be lost. The data in that column will be cast from `Decimal(15,2)` to `Integer`.
  - You are about to alter the column `price` on the `subscriptions` table. The data in that column could be lost. The data in that column will be cast from `Decimal(15,2)` to `Integer`.

*/
-- AlterTable
ALTER TABLE "applicant_test_results" ALTER COLUMN "score" SET DATA TYPE INTEGER;

-- AlterTable
ALTER TABLE "company_reviews" ALTER COLUMN "salaryEstimate" SET DATA TYPE INTEGER;

-- AlterTable
ALTER TABLE "job_applications" ALTER COLUMN "expectedSalary" SET DATA TYPE INTEGER;

-- AlterTable
ALTER TABLE "job_postings" ALTER COLUMN "salaryMin" SET DATA TYPE INTEGER,
ALTER COLUMN "salaryMax" SET DATA TYPE INTEGER;

-- AlterTable
ALTER TABLE "subscriptions" ALTER COLUMN "price" SET DATA TYPE INTEGER;
