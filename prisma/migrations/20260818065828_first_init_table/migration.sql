/*
  Warnings:

  - You are about to drop the column `isPassed` on the `applicant_test_results` table. All the data in the column will be lost.
  - The `lastEducation` column on the `users` table would be dropped and recreated. This will lead to data loss if there is data in the column.
  - A unique constraint covering the columns `[jobId,userId]` on the table `applicant_test_results` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `jobId` to the `applicant_test_results` table without a default value. This is not possible if the table is not empty.
  - Added the required column `userId` to the `applicant_test_results` table without a default value. This is not possible if the table is not empty.
  - Changed the type of `category` on the `job_postings` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.
  - Changed the type of `correctAnswer` on the `pre_selection_tests` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.
  - Changed the type of `correctAnswer` on the `skill_assessments` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.

*/
-- CreateEnum
CREATE TYPE "AnswerOption" AS ENUM ('A', 'B', 'C', 'D');

-- CreateEnum
CREATE TYPE "JobCategory" AS ENUM ('TECHNOLOGY', 'FINANCE', 'MARKETING', 'SALES', 'DESIGN', 'HUMAN_RESOURCES', 'OPERATIONS', 'EDUCATION', 'HEALTHCARE', 'OTHER');

-- CreateEnum
CREATE TYPE "LastEducation" AS ENUM ('SD', 'SMP', 'SMA_SMK', 'D3', 'S1', 'S2', 'S3');

-- CreateEnum
CREATE TYPE "InterviewStatus" AS ENUM ('SCHEDULED', 'COMPLETED', 'CANCELLED');

-- DropForeignKey
ALTER TABLE "applicant_test_results" DROP CONSTRAINT "applicant_test_results_jobApplicationId_fkey";

-- DropIndex
DROP INDEX "job_applications_status_idx";

-- DropIndex
DROP INDEX "job_postings_companyId_idx";

-- DropIndex
DROP INDEX "job_postings_isPublished_deadline_idx";

-- AlterTable
ALTER TABLE "applicant_test_results" DROP COLUMN "isPassed",
ADD COLUMN     "jobId" INTEGER NOT NULL,
ADD COLUMN     "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "submittedAt" TIMESTAMP(3),
ADD COLUMN     "userId" INTEGER NOT NULL,
ALTER COLUMN "jobApplicationId" DROP NOT NULL,
ALTER COLUMN "score" DROP NOT NULL;

-- AlterTable
ALTER TABLE "interviews" ADD COLUMN     "reminderSentAt" TIMESTAMP(3),
ADD COLUMN     "status" "InterviewStatus" NOT NULL DEFAULT 'SCHEDULED';

-- AlterTable
ALTER TABLE "job_postings" ADD COLUMN     "deletedAt" TIMESTAMP(3),
ADD COLUMN     "hasPreSelectionTest" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "testDurationMinutes" INTEGER,
DROP COLUMN "category",
ADD COLUMN     "category" "JobCategory" NOT NULL;

-- AlterTable
ALTER TABLE "pre_selection_tests" DROP COLUMN "correctAnswer",
ADD COLUMN     "correctAnswer" "AnswerOption" NOT NULL;

-- AlterTable
ALTER TABLE "skill_assessments" DROP COLUMN "correctAnswer",
ADD COLUMN     "correctAnswer" "AnswerOption" NOT NULL;

-- AlterTable
ALTER TABLE "users" ADD COLUMN     "city" TEXT,
ADD COLUMN     "province" TEXT,
DROP COLUMN "lastEducation",
ADD COLUMN     "lastEducation" "LastEducation";

-- CreateTable
CREATE TABLE "applicant_test_answers" (
    "id" SERIAL NOT NULL,
    "testResultId" INTEGER NOT NULL,
    "questionId" INTEGER NOT NULL,
    "selectedAnswer" "AnswerOption" NOT NULL,
    "isCorrect" BOOLEAN NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "applicant_test_answers_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "applicant_test_answers_questionId_idx" ON "applicant_test_answers"("questionId");

-- CreateIndex
CREATE UNIQUE INDEX "applicant_test_answers_testResultId_questionId_key" ON "applicant_test_answers"("testResultId", "questionId");

-- CreateIndex
CREATE INDEX "applicant_test_results_userId_idx" ON "applicant_test_results"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "applicant_test_results_jobId_userId_key" ON "applicant_test_results"("jobId", "userId");

-- CreateIndex
CREATE INDEX "interviews_interviewDate_status_reminderSentAt_idx" ON "interviews"("interviewDate", "status", "reminderSentAt");

-- CreateIndex
CREATE INDEX "job_applications_jobId_createdAt_idx" ON "job_applications"("jobId", "createdAt");

-- CreateIndex
CREATE INDEX "job_applications_jobId_status_idx" ON "job_applications"("jobId", "status");

-- CreateIndex
CREATE INDEX "job_postings_companyId_deletedAt_idx" ON "job_postings"("companyId", "deletedAt");

-- CreateIndex
CREATE INDEX "job_postings_deletedAt_isPublished_deadline_idx" ON "job_postings"("deletedAt", "isPublished", "deadline");

-- AddForeignKey
ALTER TABLE "applicant_test_results" ADD CONSTRAINT "applicant_test_results_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "job_postings"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "applicant_test_results" ADD CONSTRAINT "applicant_test_results_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "applicant_test_results" ADD CONSTRAINT "applicant_test_results_jobApplicationId_fkey" FOREIGN KEY ("jobApplicationId") REFERENCES "job_applications"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "applicant_test_answers" ADD CONSTRAINT "applicant_test_answers_testResultId_fkey" FOREIGN KEY ("testResultId") REFERENCES "applicant_test_results"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "applicant_test_answers" ADD CONSTRAINT "applicant_test_answers_questionId_fkey" FOREIGN KEY ("questionId") REFERENCES "pre_selection_tests"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
