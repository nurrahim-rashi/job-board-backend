import type { Prisma } from "../../generated/prisma/client.js";
import { prisma } from "../../lib/prisma.js";
import { buildBirthDateFilter, calculateAge } from "../../utils/applicant.util.js";
import { ApplicantQueryInput } from "../../validators/applicant.validator.js";

export const getApplicantListService = async (
  jobId: number,
  query: ApplicantQueryInput,
) => {
  const {
    page,
    limit,
    name,
    minAge,
    maxAge,
    minSalary,
    maxSalary,
    education,
    status,
    sortBy,
    sortOrder,
  } = query;

  const birthDate = buildBirthDateFilter(minAge, maxAge);

  const where: Prisma.JobApplicationWhereInput = {
    jobId,
    status: status ?? { not: "DRAFT" },
    ...((minSalary || maxSalary) && {
      expectedSalary: {
        ...(minSalary && { gte: minSalary }),
        ...(maxSalary && { lte: maxSalary }),
      },
    }),
    user: {
      ...(name && { name: { contains: name, mode: "insensitive" as const } }),
      ...(education && {
        lastEducation: { contains: education, mode: "insensitive" as const },
      }),
      ...(birthDate && { birthDate }),
    },
  };

  const orderBy: Prisma.JobApplicationOrderByWithRelationInput =
    sortBy === "name" ? { user: { name: sortOrder } } : { [sortBy]: sortOrder };

  const [applications, total] = await prisma.$transaction([
    prisma.jobApplication.findMany({
      where,
      orderBy,
      skip: (page - 1) * limit,
      take: limit,
      include: {
        user: {
          select: {
            id: true,
            name: true,
            avatar: true,
            birthDate: true,
            lastEducation: true,
          },
        },
        testResult: {
          select: { score: true, submittedAt: true },
        },
      },
    }),
    prisma.jobApplication.count({ where }),
  ]);

  return {
    data: applications.map((application) => ({
      id: application.id,
      status: application.status,
      expectedSalary: application.expectedSalary,
      cvFile: application.cvFile,
      appliedAt: application.createdAt,
      applicant: {
        id: application.user.id,
        name: application.user.name,
        avatar: application.user.avatar,
        age: calculateAge(application.user.birthDate),
        lastEducation: application.user.lastEducation,
      },
      testScore: application.testResult?.score ?? null,
    })),
    meta: {
      page,
      limit,
      total,
      totalPage: Math.ceil(total / limit),
    },
  };
};
