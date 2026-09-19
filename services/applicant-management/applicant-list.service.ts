import type { Prisma } from "../../generated/prisma/client.js";
import { prisma } from "../../lib/prisma.js";
import {
  buildBirthDateFilter,
  calculateAge,
} from "../../utils/applicant.util.js";
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
    salaryCurrency,
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
    ...(salaryCurrency && { expectedSalaryCurrency: salaryCurrency }),
    user: {
      ...(name && { name: { contains: name, mode: "insensitive" as const } }),
      ...(birthDate && { birthDate }),
    },
    ...(education && { lastEducationSnapshot: { contains: education, mode: "insensitive" as const } }),
  };

  const orderBy: Prisma.JobApplicationOrderByWithRelationInput =
    sortBy === "name" ? { user: { name: sortOrder } } : { [sortBy]: sortOrder };

  const now = new Date();

  const prioritySubscriptionFilter: Prisma.UserSubscriptionWhereInput = {
    status: "ACTIVE",
    endDate: {
      gte: now,
    },
    subscription: {
      name: "PROFESSIONAL",
    },
  };

  const priorityWhere: Prisma.JobApplicationWhereInput = {
    AND: [
      where,
      {
        user: {
          subscriptions: {
            some: prioritySubscriptionFilter,
          },
        },
      },
    ],
  };

  const regularWhere: Prisma.JobApplicationWhereInput = {
    AND: [
      where,
      {
        user: {
          subscriptions: {
            none: prioritySubscriptionFilter,
          },
        },
      },
    ],
  };

  const [priorityCount, regularCount] = await prisma.$transaction([
    prisma.jobApplication.count({
      where: priorityWhere,
    }),
    prisma.jobApplication.count({
      where: regularWhere,
    }),
  ]);

  const offset = (page - 1) * limit;

  let prioritySkip = 0;
  let priorityTake = 0;
  let regularSkip = 0;
  let regularTake = 0;

  if (offset < priorityCount) {
    prioritySkip = offset;
    priorityTake = Math.min(limit, priorityCount - offset);
    regularTake = limit - priorityTake;
  } else {
    regularSkip = offset - priorityCount;
    regularTake = limit;
  }

  const [priorityApplications, regularApplications] = await prisma.$transaction(
    [
      prisma.jobApplication.findMany({
        where: priorityWhere,
        orderBy,
        skip: prioritySkip,
        take: priorityTake,
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

      prisma.jobApplication.findMany({
        where: regularWhere,
        orderBy,
        skip: regularSkip,
        take: regularTake,
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
    ],
  );

  const applications = [
    ...priorityApplications.map((application) => ({
      ...application,
      priorityReview: true,
    })),
    ...regularApplications.map((application) => ({
      ...application,
      priorityReview: false,
    })),
  ];

  const total = priorityCount + regularCount;

  return {
    data: applications.map((application) => ({
      id: application.id,
      status: application.status,
      expectedSalary: application.expectedSalary,
      expectedSalaryCurrency: application.expectedSalaryCurrency,
      cvFile: application.cvFile,
      appliedAt: application.createdAt,
      priorityReview: application.priorityReview,
      applicant: {
        id: application.user.id,
        name: application.user.name,
        avatar: application.user.avatar,
        age: calculateAge(application.user.birthDate),
        lastEducation: application.lastEducationSnapshot ?? application.user.lastEducation,
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
