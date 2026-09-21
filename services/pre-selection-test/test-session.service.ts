import { Prisma } from "../../generated/prisma/client.js";
import { prisma } from "../../lib/prisma.js";
import { ApiError } from "../../utils/api-error.js";

type ApplicationWithJob = Prisma.JobApplicationGetPayload<{
  include: { job: true };
}>;

export const getActiveSession = async (application: ApplicationWithJob) => {
  const { job } = application;

  if (application.status !== "TEST_ASSIGNED") {
    throw new ApiError("Test is not currently running", 409);
  }

  const duration = application.job.testDurationMinutes;
  if (!duration) {
    throw new ApiError("Test duration has not been set", 409);
  }

  const result = await prisma.applicantTestResult.findUnique({
    where: { jobId_userId: { jobId: job.id, userId: application.userId } },
  });

  if (!result) {
    throw new ApiError("Test has not started", 409);
  }

  if (result.submittedAt) {
    throw new ApiError("This test has already been taken", 409);
  }

  return {
    result,
    duration,
  };
};

export const finalizeTest = async (
  testResultId: number,
  durationMinutes?: number,
) => {
  const result = await prisma.applicantTestResult.findUnique({
    where: { id: testResultId },
  });

  if (!result) {
    throw new ApiError("Pre-selection test has not been completed", 404);
  }

  if (result.submittedAt) {
    return {
      score: Number(result.score ?? 0),
      submittedAt: result.submittedAt,
    };
  }

  const [correctAnswer, totalQuestions] = await Promise.all([
    prisma.applicantTestAnswer.count({
      where: { testResultId, isCorrect: true },
    }),
    prisma.preSelectionTest.count({
      where: { jobId: result.jobId },
    }),
  ]);

  const score =
    totalQuestions > 0
      ? Math.round((correctAnswer / totalQuestions) * 100)
      : 0;

  const deadline = durationMinutes
    ? new Date(result.startedAt.getTime() + durationMinutes * 60_000)
    : null;
  const submittedAt =
    deadline && deadline.getTime() < Date.now() ? deadline : new Date();

  await prisma.$transaction(async (tx)=>{
    await tx.applicantTestResult.update({
        where: {id: testResultId},
        data: {score, submittedAt}
    })

    if(result.jobApplicationId){
        await tx.jobApplication.update({
            where: {id: result.jobApplicationId},
            data: {status: "PROCESS"}
        })
    }
  })
  return {score, correctAnswer, totalQuestions, submittedAt}
};
