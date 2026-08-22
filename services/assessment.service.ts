import { prisma } from "../lib/prisma.js";
import { ApiError } from "../utils/api-error.js";
import { UserRole } from "../generated/prisma/enums.js";

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
