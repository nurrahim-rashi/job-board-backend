import { prisma } from "../lib/prisma.js";
import { ApiError } from "../utils/api-error.js";
import { AnswerOption, UserRole } from "../generated/prisma/enums.js";
import { checkActiveSubscription } from "../helpers/subscription.helper.js";
import {
  getAssessmentAttempt,
  processAssessmentAnswers,
  validateAssessmentDeadline,
  validateSubmittedAnswers,
} from "../helpers/assessment.helper.js";

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

export const startAssessmentService = async (
  userId: number,
  assessmentId: number,
) => {
  await checkActiveSubscription(userId);

  const assessment = await prisma.skillAssessment.findUnique({
    where: {
      id: assessmentId,
    },
    include: {
      questions: {
        orderBy: {
          questionOrder: "asc",
        },
      },
    },
  });

  if (!assessment) {
    throw new ApiError("Assessment not found", 404);
  }

  if (assessment.questions.length !== 25) {
    throw new ApiError(
      "Assessment must contain exactly 25 questions before it can be started",
      409,
    );
  }

  const activeAttempt = await prisma.skillAssessmentResult.findFirst({
    where: {
      userId,
      assessmentId,
      completedAt: null,
    },
    orderBy: {
      startedAt: "desc",
    },
  });

  if (activeAttempt) {
    const activeAttemptExpiresAt = new Date(
      activeAttempt.startedAt.getTime() +
        assessment.durationMinutes * 60 * 1000,
    );

    if (activeAttemptExpiresAt > new Date()) {
      throw new ApiError(
        "You already have an active attempt for this assessment",
        409,
      );
    }
  }

  const startedAt = new Date();

  const result = await prisma.skillAssessmentResult.create({
    data: {
      userId,
      assessmentId,
      score: 0,
      isPassed: false,
      startedAt,
    },
  });

  const questions = assessment.questions.map((question) => ({
    id: question.id,
    question: question.question,
    options: question.options,
    questionOrder: question.questionOrder,
  }));

  const expiresAt = new Date(
    startedAt.getTime() + assessment.durationMinutes * 60 * 1000,
  );

  return {
    resultId: result.id,
    assessment: {
      id: assessment.id,
      skillName: assessment.skillName,
      title: assessment.title,
      durationMinutes: assessment.durationMinutes,
      questionCount: assessment.questionCount,
    },
    startedAt,
    expiresAt,
    questions,
  };
};

export const submitAssessmentService = async (
  userId: number,
  assessmentId: number,
  resultId: number,
  answers: {
    questionId: number;
    answer: AnswerOption;
  }[],
) => {
  const result = await getAssessmentAttempt(userId, assessmentId, resultId);

  validateAssessmentDeadline(
    result.startedAt,
    result.assessment.durationMinutes,
  );

  const questionIds = validateSubmittedAnswers(answers);

  const processedAnswers = await processAssessmentAnswers(
    assessmentId,
    resultId,
    answers,
    questionIds,
  );

  const correctCount = processedAnswers.filter(
    (answer) => answer.isCorrect,
  ).length;

  const score = Math.round((correctCount / 25) * 100);

  const isPassed = score >= result.assessment.passingScore;

  const badgeName = isPassed
    ? `${result.assessment.skillName} Skill Badge`
    : null;

  const completedAt = new Date();

  const updatedResult = await prisma.$transaction(async (tx) => {
    await tx.skillAssessmentAnswer.createMany({
      data: processedAnswers,
    });

    return tx.skillAssessmentResult.update({
      where: {
        id: resultId,
      },
      data: {
        score,
        isPassed,
        completedAt,
        badgeName,
      },
    });
  });

  return {
    resultId: updatedResult.id,
    score,
    isPassed,
    badgeName,
    completedAt,
    correctAnswers: correctCount,
    totalQuestions: 25,
  };
};

export const getUserBadgesService = async (userId: number) => {
  const passedResults = await prisma.skillAssessmentResult.findMany({
    where: {
      userId,
      isPassed: true,
      badgeName: {
        not: null,
      },
      completedAt: {
        not: null,
      },
    },
    include: {
      assessment: {
        select: {
          id: true,
          skillName: true,
          title: true,
        },
      },
    },
    orderBy: {
      completedAt: "desc",
    },
  });

  // Hanya memperlihatkan badge terbaru dari tiap assessement
  const uniqueBadges = new Map();

  for (const result of passedResults) {
    if (!uniqueBadges.has(result.assessmentId)) {
      uniqueBadges.set(result.assessmentId, {
        resultId: result.id,
        assessmentId: result.assessmentId,
        skillName: result.assessment.skillName,
        assessmentTitle: result.assessment.title,
        badgeName: result.badgeName,
        score: result.score,
        earnedAt: result.completedAt,
      });
    }
  }

  return Array.from(uniqueBadges.values());
};
