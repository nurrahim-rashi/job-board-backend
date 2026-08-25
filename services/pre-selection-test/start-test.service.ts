import { prisma } from "../../lib/prisma.js";
import type { Prisma } from "../../generated/prisma/client.js";
import { ApiError } from "../../utils/api-error.js";
import { getRemainingSeconds, isExpired, parseOptions } from "../../utils/pre-selection-test.util.js";
import { finalizeTest } from "./test-session.service.js";

type ApplicationWithJob = Prisma.JobApplicationGetPayload<{
  include: { job: true };
}>;

export const startTestService = async (application: ApplicationWithJob) => {
  const { job } = application;

  if (!job.hasPreSelectionTest) {
    throw new ApiError("This job posting does not have a Pre-Selection Test", 400);
  }
  if (application.status === "PENDING") {
    throw new ApiError(
      "Company Admin has not sent the Pre-Selection Test yet",
      403,
    );
  }
  if (application.status !== "TEST_ASSIGNED") {
    throw new ApiError("This test can no longer be taken", 409);
  }

  const duration = job.testDurationMinutes;
  if (!duration) {
    throw new ApiError("Pre-Selection Test duration has not been set", 409);
  }

  let result = await prisma.applicantTestResult.findUnique({
    where: { jobId_userId: { jobId: job.id, userId: application.userId } },
  });

  if (!result) {
    try {
      result = await prisma.applicantTestResult.create({
        data: {
          jobId: job.id,
          userId: application.userId,
          jobApplicationId: application.id,
          startedAt: new Date(),
        },
      });
    } catch (error) {
      if (
        typeof error === "object" &&
        error !== null &&
        "code" in error &&
        error.code === "P2002"
      ) {
        result = await prisma.applicantTestResult.findUniqueOrThrow({
          where: {
            jobId_userId: { jobId: job.id, userId: application.userId },
          },
        });
      } else {
        throw error;
      }
    }
  }

  if (result.submittedAt) {
    throw new ApiError("This test has already been completed", 409);
  }

  if (isExpired(result.startedAt, duration)) {
    await finalizeTest(result.id)
    throw new ApiError("Test time has expired", 409)
  }

  const [questions, savedAnswers] = await Promise.all([
    prisma.preSelectionTest.findMany({
        where: {jobId:job.id},
        orderBy: {id: "asc"},
        select: {id: true, question: true, options: true}
    }),
    prisma.applicantTestAnswer.findMany({
        where: {testResultId: result.id},
        select: {questionId: true, selectedAnswer: true}
    })
  ])

  return {
    testResultId: result.id,
    startedAt: result.startedAt,
    durationMinutes: duration,
    remainingSeconds: getRemainingSeconds(result.startedAt, duration),
    questions: questions.map((q)=>({
        id: q.id,
        question: q.question,
        options: parseOptions(q.options)
    })),
    savedAnswers,
  }
};

