import { prisma } from "../lib/prisma.js";
import { ApiError } from "../utils/api-error.js";
import { AnswerOption } from "../generated/prisma/enums.js";

export const getAssessmentAttempt = async (
  userId: number,
  assessmentId: number,
  resultId: number,
) => {
  const result = await prisma.skillAssessmentResult.findFirst({
    where: {
      id: resultId,
      userId,
      assessmentId,
    },
    include: {
      assessment: true,
    },
  });

  if (!result) {
    throw new ApiError("Assessment attempt not found", 404);
  }

  if (result.completedAt) {
    throw new ApiError("Assessment has already been submitted", 409);
  }

  return result;
};

export const validateAssessmentDeadline = (
  startedAt: Date,
  durationMinutes: number,
) => {
  const expiresAt = new Date(startedAt.getTime() + durationMinutes * 60 * 1000);

  if (new Date() > expiresAt) {
    throw new ApiError("Assessment time has expired", 409);
  }
};

export const validateSubmittedAnswers = (
  answers: {
    questionId: number;
    answer: AnswerOption;
  }[],
) => {
  if (answers.length !== 25) {
    throw new ApiError("Exactly 25 answers are required", 400);
  }

  const questionIds = answers.map((answer) => answer.questionId);

  if (new Set(questionIds).size !== 25) {
    throw new ApiError("Duplicate question answers are not allowed", 400);
  }

  return questionIds;
};

export const processAssessmentAnswers = async (
  assessmentId: number,
  resultId: number,
  answers: {
    questionId: number;
    answer: AnswerOption;
  }[],
  questionIds: number[],
) => {
  const questions = await prisma.skillAssessmentQuestion.findMany({
    where: {
      assessmentId,
      id: {
        in: questionIds,
      },
    },
    select: {
      id: true,
      correctAnswer: true,
    },
  });

  if (questions.length !== 25) {
    throw new ApiError(
      "One or more questions do not belong to this assessment",
      400,
    );
  }

  const correctAnswerMap = new Map(
    questions.map((question) => [question.id, question.correctAnswer]),
  );

  return answers.map((answer) => ({
    resultId,
    questionId: answer.questionId,
    answer: answer.answer,
    isCorrect: answer.answer === correctAnswerMap.get(answer.questionId),
  }));
};
