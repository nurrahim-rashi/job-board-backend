import type { Prisma } from "../../generated/prisma/client.js";
import { prisma } from "../../lib/prisma.js";
import { ApiError } from "../../utils/api-error.js";
import { getRemainingSeconds, isExpired } from "../../utils/pre-selection-test.util.js";
import { SaveAnswerInput } from "../../validators/pre-selection-test.validator.js";
import { finalizeTest, getActiveSession } from "./test-session.service.js";

type ApplicationWithJob = Prisma.JobApplicationGetPayload<{
  include: { job: true };
}>;

export const saveAnswerService = async (
  application: ApplicationWithJob,
  input: SaveAnswerInput,
) => {
    const { result, duration } = await getActiveSession(application);

    if(isExpired(result.createdAt, duration)){
        await finalizeTest(result.id);
        throw new ApiError("Test time has expired", 409)
    }

    const question = await prisma.preSelectionTest.findFirst({
        where: {id: input.questionId, jobId: application.jobId },
        select: { id: true, correctAnswer: true }
    })

    if(!question){
        throw new ApiError("Question not found", 409)
    }

    const isCorrect = question.correctAnswer === input.selectedAnswer;

    await prisma.applicantTestAnswer.upsert({
    where: {
      testResultId_questionId: {
        testResultId: result.id,
        questionId: question.id,
      },
    },
    create: {
      testResultId: result.id,
      questionId: question.id,
      selectedAnswer: input.selectedAnswer,
      isCorrect,
    },
    update: {
      selectedAnswer: input.selectedAnswer,
      isCorrect,
    },
  });

  return {
    questionId: question.id,
    selectedAnswer: input.selectedAnswer,
    remainingSeconds: getRemainingSeconds(result.startedAt, duration),
  };
};
