import { prisma } from "../lib/prisma.js";
import { ApiError } from "../utils/api-error.js";
import { AnswerOption, UserRole } from "../generated/prisma/enums.js";

export const createAssessmentService = async (
  userRole: UserRole,
  data: {
    skillName: string;
    title: string;
    description?: string;
  },
) => {
  // Cek user role nya DEVELOPER apa bukan
  if (userRole !== "DEVELOPER") {
    throw new ApiError("Only developer accounts can create assessments", 403);
  }

  // Cek ada assessment duplikat apa ngga
  const existingAssessment = await prisma.skillAssessment.findFirst({
    where: {
      skillName: data.skillName,
    },
  });

  if (existingAssessment) {
    throw new ApiError("Assessment for this skill already exists", 409);
  }

  return prisma.skillAssessment.create({
    data: {
      skillName: data.skillName,
      title: data.title,
      description: data.description,
    },
  });
};

export const createAssessmentQuestionService = async (
  userRole: UserRole,
  assessmentId: number,
  data: {
    question: string,
    options: {
      A: string,
      B: string,
      C: string,
      D: string,
    };
    correctAnswer: AnswerOption;
    questionOrder: number;
  },
) => {
  if (userRole !== "DEVELOPER") {
    throw new ApiError("Only developer accounts can manage assessment questions", 403,)
  }

  const assessment = await prisma.skillAssessment.findUnique({
    where: {
      id: assessmentId,
    },
    include: {
      _count: {
        select: {
          questions: true,
        },
      },
    },
  });

  if (!assessment) {
    throw new ApiError("Assessment not found", 404);
  }

  if (assessment._count.questions >= 25) {
    throw new ApiError("Assessment already contains the maximum of 25 questions", 409);
  }

  const existingQuestionOrder = await prisma.skillAssessmentQuestion.findUnique({
    where: {
      assessmentId_questionOrder: {
        assessmentId,
        questionOrder: data.questionOrder,
      },
    },
  });

  if (existingQuestionOrder) {
    throw new ApiError("Question order already exists for this assessment", 409);
  }

  return prisma.skillAssessmentQuestion.create({
    data: {
      assessmentId,
      question: data.question,
      options: data.options,
      correctAnswer: data.correctAnswer,
      questionOrder: data.questionOrder,
    },
  });
};