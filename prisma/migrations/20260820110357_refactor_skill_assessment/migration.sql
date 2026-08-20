/*
  Warnings:

  - You are about to drop the column `correctAnswer` on the `skill_assessments` table. All the data in the column will be lost.
  - You are about to drop the column `options` on the `skill_assessments` table. All the data in the column will be lost.
  - You are about to drop the column `question` on the `skill_assessments` table. All the data in the column will be lost.
  - You are about to drop the `user_assessments` table. If the table is not empty, all the data it contains will be lost.
  - Added the required column `title` to the `skill_assessments` table without a default value. This is not possible if the table is not empty.

*/
-- DropForeignKey
ALTER TABLE "user_assessments" DROP CONSTRAINT "user_assessments_userId_fkey";

-- AlterTable
ALTER TABLE "skill_assessments" DROP COLUMN "correctAnswer",
DROP COLUMN "options",
DROP COLUMN "question",
ADD COLUMN     "description" TEXT,
ADD COLUMN     "durationMinutes" INTEGER NOT NULL DEFAULT 30,
ADD COLUMN     "passingScore" INTEGER NOT NULL DEFAULT 75,
ADD COLUMN     "questionCount" INTEGER NOT NULL DEFAULT 25,
ADD COLUMN     "title" TEXT NOT NULL;

-- DropTable
DROP TABLE "user_assessments";

-- CreateTable
CREATE TABLE "skill_assessment_questions" (
    "id" SERIAL NOT NULL,
    "assessmentId" INTEGER NOT NULL,
    "question" TEXT NOT NULL,
    "options" JSONB NOT NULL,
    "correctAnswer" "AnswerOption" NOT NULL,
    "questionOrder" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "skill_assessment_questions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "skill_assessment_results" (
    "id" SERIAL NOT NULL,
    "userId" INTEGER NOT NULL,
    "assessmentId" INTEGER NOT NULL,
    "score" INTEGER NOT NULL,
    "isPassed" BOOLEAN NOT NULL DEFAULT false,
    "startedAt" TIMESTAMP(3) NOT NULL,
    "completedAt" TIMESTAMP(3),
    "certificateCode" TEXT,
    "badgeName" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "skill_assessment_results_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "skill_assessment_questions_assessmentId_idx" ON "skill_assessment_questions"("assessmentId");

-- CreateIndex
CREATE UNIQUE INDEX "skill_assessment_questions_assessmentId_questionOrder_key" ON "skill_assessment_questions"("assessmentId", "questionOrder");

-- CreateIndex
CREATE UNIQUE INDEX "skill_assessment_results_certificateCode_key" ON "skill_assessment_results"("certificateCode");

-- CreateIndex
CREATE INDEX "skill_assessment_results_userId_idx" ON "skill_assessment_results"("userId");

-- CreateIndex
CREATE INDEX "skill_assessment_results_assessmentId_idx" ON "skill_assessment_results"("assessmentId");

-- CreateIndex
CREATE INDEX "skill_assessment_results_userId_assessmentId_idx" ON "skill_assessment_results"("userId", "assessmentId");

-- AddForeignKey
ALTER TABLE "skill_assessment_questions" ADD CONSTRAINT "skill_assessment_questions_assessmentId_fkey" FOREIGN KEY ("assessmentId") REFERENCES "skill_assessments"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "skill_assessment_results" ADD CONSTRAINT "skill_assessment_results_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "skill_assessment_results" ADD CONSTRAINT "skill_assessment_results_assessmentId_fkey" FOREIGN KEY ("assessmentId") REFERENCES "skill_assessments"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
