import type { JobPosting } from "../../generated/prisma/client.js";
import { prisma } from "../../lib/prisma.js";
import { ApiError } from "../../utils/api-error.js";
import { parseOptions } from "../../utils/pre-selection-test.util.js";

export const getTestResultService = async (
  job: JobPosting,
  applicationId: number,
) => {
  const application = await prisma.jobApplication.findFirst({
    where: { id: applicationId, jobId: job.id },
    include: {
      user: { select: { id: true, name: true, avatar: true } },
      testResult: true,
    },
  });

  if (!application) {
    throw new ApiError("Application not found", 404);
  }

  if (!application.testResult) {
    throw new ApiError("This applicant has not taken the test yet", 404);
  }

  const [questions, answers] = await Promise.all([
    prisma.preSelectionTest.findMany({
      where: { jobId: job.id },
      orderBy: { id: "asc" },
    }),
    prisma.applicantTestAnswer.findMany({
      where: { testResultId: application.testResult.id },
    }),
  ]);

  const answerMap = new Map(answers.map((a) => [a.questionId, a]));

  return {
    applicant: application.user,
    score: Number(application.testResult.score ?? 0),
    submittedAt: application.testResult.submittedAt,
    startedAt: application.testResult.startedAt,
    correctCount: answers.filter((a) => a.isCorrect).length,
    totalQuestions: questions.length,
    details: questions.map((q, index) => {
      const answer = answerMap.get(q.id);

      return {
        number: index + 1,
        questionId: q.id,
        question: q.question,
        options: parseOptions(q.options),
        correctAnswer: q.correctAnswer,
        selectedAnswer: answer?.selectedAnswer ?? null,
        isCorrect: answer?.isCorrect ?? false,
      };
    }),
  };
};