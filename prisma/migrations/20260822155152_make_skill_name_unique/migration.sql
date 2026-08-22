/*
  Warnings:

  - A unique constraint covering the columns `[skillName]` on the table `skill_assessments` will be added. If there are existing duplicate values, this will fail.

*/
-- CreateIndex
CREATE UNIQUE INDEX "skill_assessments_skillName_key" ON "skill_assessments"("skillName");
