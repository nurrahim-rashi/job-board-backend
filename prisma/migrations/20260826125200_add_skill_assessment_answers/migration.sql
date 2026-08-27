-- CreateTable
CREATE TABLE "skill_assessment_answers" (
    "id" SERIAL NOT NULL,
    "resultId" INTEGER NOT NULL,
    "questionId" INTEGER NOT NULL,
    "answer" "AnswerOption" NOT NULL,
    "isCorrect" BOOLEAN NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "skill_assessment_answers_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "skill_assessment_answers_resultId_idx" ON "skill_assessment_answers"("resultId");

-- CreateIndex
CREATE INDEX "skill_assessment_answers_questionId_idx" ON "skill_assessment_answers"("questionId");

-- CreateIndex
CREATE UNIQUE INDEX "skill_assessment_answers_resultId_questionId_key" ON "skill_assessment_answers"("resultId", "questionId");

-- AddForeignKey
ALTER TABLE "skill_assessment_answers" ADD CONSTRAINT "skill_assessment_answers_resultId_fkey" FOREIGN KEY ("resultId") REFERENCES "skill_assessment_results"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "skill_assessment_answers" ADD CONSTRAINT "skill_assessment_answers_questionId_fkey" FOREIGN KEY ("questionId") REFERENCES "skill_assessment_questions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
