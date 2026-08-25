import { prisma } from "../lib/prisma.js";
import { ApiError } from "../utils/api-error.js";
import { AnswerOption, UserRole } from "../generated/prisma/enums.js";
import { checkActiveSubscription } from "../helpers/subscription.helper.js";

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
    question: string;
    options: {
      A: string;
      B: string;
      C: string;
      D: string;
    };
    correctAnswer: AnswerOption;
    questionOrder: number;
  },
) => {
  if (userRole !== "DEVELOPER") {
    throw new ApiError(
      "Only developer accounts can manage assessment questions",
      403,
    );
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
    throw new ApiError(
      "Assessment already contains the maximum of 25 questions",
      409,
    );
  }

  const existingQuestionOrder = await prisma.skillAssessmentQuestion.findUnique(
    {
      where: {
        assessmentId_questionOrder: {
          assessmentId,
          questionOrder: data.questionOrder,
        },
      },
    },
  );

  if (existingQuestionOrder) {
    throw new ApiError(
      "Question order already exists for this assessment",
      409,
    );
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

export const getAssessmentQuestionsService = async (
  userRole: UserRole,
  assessmentId: number,
) => {
  if (userRole !== "DEVELOPER") {
    throw new ApiError(
      "Only developer accounts can manage assessment questions",
      403,
    );
  }

  const assessment = await prisma.skillAssessment.findUnique({
    where: {
      id: assessmentId,
    },
  });

  if (!assessment) {
    throw new ApiError("Assessment not found", 404);
  }

  return prisma.skillAssessmentQuestion.findMany({
    where: {
      assessmentId,
    },
    orderBy: {
      questionOrder: "asc",
    },
  });
};

export const updateAssessmentQuestionService = async (
  userRole: UserRole,
  assessmentId: number,
  questionId: number,
  data: {
    question?: string;
    options?: {
      A: string;
      B: string;
      C: string;
      D: string;
    };
    correctAnswer?: AnswerOption;
    questionOrder?: number;
  },
) => {
  if (userRole !== "DEVELOPER") {
    throw new ApiError(
      "Only developer accounts can manage assessment questions",
      403,
    );
  }

  const question = await prisma.skillAssessmentQuestion.findFirst({
    where: {
      id: questionId,
      assessmentId,
    },
  });

  if (!question) {
    throw new ApiError("Assessment question not found", 404);
  }

  if (
    data.questionOrder !== undefined &&
    data.questionOrder !== question.questionOrder
  ) {
    const duplicateOrder = await prisma.skillAssessmentQuestion.findFirst({
      where: {
        assessmentId,
        questionOrder: data.questionOrder,
        NOT: {
          id: questionId,
        },
      },
    });

    if (duplicateOrder) {
      throw new ApiError(
        "Question order already exists for this assessment",
        409,
      );
    }
  }

  return prisma.skillAssessmentQuestion.update({
    where: {
      id: questionId,
    },
    data,
  });
};

export const deleteAssessmentQuestionService = async (
  userRole: UserRole,
  assessmentId: number,
  questionId: number,
) => {
  if (userRole !== "DEVELOPER") {
    throw new ApiError(
      "Only developer accounts can manage assessment questions",
      403,
    );
  }

  const question = await prisma.skillAssessmentQuestion.findFirst({
    where: {
      id: questionId,
      assessmentId,
    },
  });

  if (!question) {
    throw new ApiError("Assessment question not found", 404);
  }

  await prisma.skillAssessmentQuestion.delete({
    where: {
      id: questionId,
    },
  });

  return {
    message: "Assessment question deleted successfully",
  };
};

export const getAvailableAssessmentService = async (userId: number) => {
  await checkActiveSubscription(userId);

  return prisma.skillAssessment.findMany({
    select: {
      id: true,
      skillName: true,
      title: true,
      description: true,
      passingScore: true,
      durationMinutes: true,
      questionCount: true,
      createdAt: true,
      _count: {
        select: {
          questions: true,
        },
      },
    },
    orderBy: {
      skillName: "asc",
    },
  });
};

export const getAssessmentDiscoveryDetailService = async (
  userId: number,
  assessmentId: number,
) => {
  await checkActiveSubscription(userId);

  const assessment = await prisma.skillAssessment.findUnique({
    where: {
      id: assessmentId,
    },
    select: {
      id: true,
      skillName: true,
      title: true,
      description: true,
      passingScore: true,
      durationMinutes: true,
      questionCount: true,
      createdAt: true,
    },
  });

  if (!assessment) {
    throw new ApiError("Assessment not found", 404);
  }

  return assessment;
};