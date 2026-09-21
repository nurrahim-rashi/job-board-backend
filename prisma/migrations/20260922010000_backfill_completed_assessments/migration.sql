-- Preserve previously complete assessments as published when introducing
-- the assessment publishing workflow.
UPDATE "skill_assessments" AS sa
SET
  "isPublished" = true,
  "publishedAt" = COALESCE(sa."publishedAt", CURRENT_TIMESTAMP)
WHERE sa."isPublished" = false
  AND (
    SELECT COUNT(*)
    FROM "skill_assessment_questions" AS q
    WHERE q."assessmentId" = sa."id"
  ) = sa."questionCount";
