import type { JobPosting } from "../generated/prisma/client.js";
import { prisma } from "../lib/prisma.js";
import { ApiError } from "../utils/api-error.js";
import { isTestLocked, parseOptions } from "../utils/pre-selection-test.util.js";
import {
  ActivationInput,
  SaveTestInput,
} from "../validators/pre-selection-test.validator.js";

const REQUIRED_QUESTION_COUNT = 25;

export const getTestService = async (job: JobPosting) => {
  const questions = await prisma.preSelectionTest.findMany({
    where: { jobId: job.id },
    orderBy: { id: "asc" },
  });
  const locked = await isTestLocked(job.id);

  return { 
    questions: questions.map((q) => ({
      id: q.id,
      question: q.question,
      options: parseOptions(q.options),
      correctAnswer: q.correctAnswer,
    })),
    totalQuestions: questions.length,
    requiredQuestions: REQUIRED_QUESTION_COUNT,
    hasPreSelectionTest: job.hasPreSelectionTest,
    testDurationMinutes: job.testDurationMinutes,
    isLocked: locked,
  };
};

export const saveQuestionsService = async (jobId: number, input: SaveTestInput) => {
  const locked = await isTestLocked(jobId);
  if (locked) {
    throw new ApiError(
      "Questions cannot be edited because someone has already answered it",
      409,
    );
  }

  await prisma.$transaction([
    prisma.preSelectionTest.deleteMany({ where: { jobId } }),
    prisma.preSelectionTest.createMany({
      data: input.questions.map((q) => ({
        jobId,
        question: q.question,
        options: q.options,
        correctAnswer: q.correctAnswer,
      })),
    }),
  ]);
  return { totalQuestions: input.questions.length };
};

export const setActivationService = async (
  job: JobPosting,
  input: ActivationInput,
) => {
  if (!input.hasPreSelectionTest) {
    return prisma.jobPosting.update({
      where: { id: job.id },
      data: { hasPreSelectionTest: false },
    });
  }

  const total = await prisma.preSelectionTest.count({
    where: { jobId: job.id },
  });

  if (total !== REQUIRED_QUESTION_COUNT) {
    throw new ApiError("The test cannot be activated because the number of questions is less than 25", 400);
  }

  const duration = input.testDurationMinutes ?? job.testDurationMinutes;
  if (!duration) {
    throw new ApiError("Test duration is required", 400);
  }

  return prisma.jobPosting.update({
    where: { id: job.id },
    data: { hasPreSelectionTest: true, testDurationMinutes: duration },
  });
};

export const deleteTestService = async (jobId: number) => {
  const locked = await isTestLocked(jobId);
  if (locked) {
    throw new ApiError(
      "Questions cannot be deleted because someone has already started answering them",
      409,
    );
  }

  await prisma.$transaction([
    prisma.preSelectionTest.deleteMany({ where: { jobId } }),
    prisma.jobPosting.update({
      where: { id: jobId },
      data: { hasPreSelectionTest: false, testDurationMinutes: null },
    }),
  ]);
  return { message: "Test questions deleted successfully" };
};
