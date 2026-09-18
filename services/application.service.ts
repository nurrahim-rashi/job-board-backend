import { Prisma } from "../generated/prisma/client.js";
import { prisma } from "../lib/prisma.js";
import { ApiError } from "../utils/api-error.js";
import { readInterviewProposal } from "../utils/interview-proposal.util.js";

const applicationSelect = {
  id: true,
  jobId: true,
  userId: true,
  cvFile: true,
  expectedSalary: true,
  status: true,
  rejectionReason: true,
  createdAt: true,
  updatedAt: true,
  job: {
    select: {
      id: true,
      slug: true,
      title: true,
      cityLocation: true,
      provinceLocation: true,
      countryLocation: true,
      category: true,
      salaryMin: true,
      salaryMax: true,
      deadline: true,
      company: { select: { id: true, companyName: true, logo: true } },
    },
  },
  interview: {
    select: {
      interviewDate: true,
      locationOrLink: true,
      notes: true,
      status: true,
      createdAt: true,
    },
  },
} as const;

export async function createApplication(
  userId: number,
  slug: string,
  cvFile: Express.Multer.File,
  expectedSalary?: number,
) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      role: true,
      emailVerifiedAt: true,
      birthDate: true,
      gender: true,
      lastEducation: true,
      address: true,
      city: true,
      province: true,
    },
  });
  if (!user || user.role !== "JOB_SEEKER")
    throw new ApiError("Only job seekers can apply", 403);
  if (!user.emailVerifiedAt)
    throw new ApiError("Verify your email before applying", 403);
  if (
    !user.birthDate ||
    !user.gender ||
    !user.lastEducation ||
    !user.address?.trim() ||
    !user.city?.trim() ||
    !user.province?.trim()
  ) {
    throw new ApiError(
      "Complete your birth date, gender, education, and address before applying",
      400,
    );
  }
  if (!/^.+ in .+ at .+$/i.test(user.lastEducation))
    throw new ApiError(
      "Add your education level, major, and school or university before applying",
      400,
    );
  const job = await prisma.jobPosting.findFirst({
    where: {
      slug,
      isPublished: true,
      deletedAt: null,
      deadline: { gte: new Date() },
    },
    select: { id: true },
  });
  if (!job) throw new ApiError("Job is not available", 404);
  const duplicate = await prisma.jobApplication.findUnique({
    where: { jobId_userId: { jobId: job.id, userId } },
  });
  if (duplicate)
    throw new ApiError("You have already applied for this job", 409);
  return prisma.jobApplication.create({
    data: {
      jobId: job.id,
      userId,
      cvFile: `/uploads/cvs/${cvFile.filename}`,
      expectedSalary,
      lastEducationSnapshot: user.lastEducation,
    },
    select: applicationSelect,
  });
}

export async function getMyApplications(userId: number) {
  const applications = await prisma.jobApplication.findMany({
    where: { userId },
    select: applicationSelect,
    orderBy: { createdAt: "desc" },
  });
  return applications.map((application) => ({
    ...application,
    expectedSalaryRequestedAt: null,
  }));
}

export async function getMyApplicationsPage(
  userId: number,
  page: number,
  limit: number,
  view?: "interviews" | "tests" | "closed",
  filterStatus?:
    | "SCHEDULED"
    | "COMPLETED"
    | "CANCELLED"
    | "ACCEPTED"
    | "REJECTED",
) {
  const where: Prisma.JobApplicationWhereInput = {
    userId,
    status: { not: "DRAFT" as const },
    ...(view === "interviews"
      ? {
          interview:
            filterStatus === "SCHEDULED" ||
            filterStatus === "COMPLETED" ||
            filterStatus === "CANCELLED"
              ? { is: { status: filterStatus } }
              : { isNot: null },
        }
      : {}),
    ...(view === "tests" ? { status: "TEST_ASSIGNED" as const } : {}),
    ...(view === "closed"
      ? {
          status:
            filterStatus === "ACCEPTED" || filterStatus === "REJECTED"
              ? filterStatus
              : { in: ["ACCEPTED" as const, "REJECTED" as const] },
        }
      : {}),
  };
  const [items, total] = await Promise.all([
    prisma.jobApplication.findMany({
      where,
      select: applicationSelect,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.jobApplication.count({ where }),
  ]);
  return {
    items: items.map((application) => ({
      ...application,
      expectedSalaryRequestedAt: null,
    })),
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.max(1, Math.ceil(total / limit)),
    },
  };
}

export async function getMyApplicationForJob(userId: number, slug: string) {
  return prisma.jobApplication.findFirst({
    where: { userId, job: { slug } },
    select: {
      id: true,
      status: true,
      createdAt: true,
      updatedAt: true,
      rejectionReason: true,
      job: { select: { hasPreSelectionTest: true } },
      testResult: {
        select: { startedAt: true, submittedAt: true, score: true },
      },
      interview: {
        select: {
          interviewDate: true,
          locationOrLink: true,
          status: true,
          createdAt: true,
        },
      },
    },
  });
}

export async function getMyApplicationDetail(
  userId: number,
  applicationId: number,
) {
  const application = await prisma.jobApplication.findFirst({
    where: { id: applicationId, userId },
    select: applicationSelect,
  });
  if (!application) throw new ApiError("Application not found", 404);
  let expectedSalaryRequestedAt: Date | null = null;
  try {
    const [request] = await prisma.$queryRaw<
      Array<{ expectedSalaryRequestedAt: Date | null }>
    >(Prisma.sql`
      SELECT "expectedSalaryRequestedAt"
      FROM "job_applications"
      WHERE "id" = ${applicationId}
    `);
    expectedSalaryRequestedAt = request?.expectedSalaryRequestedAt ?? null;
  } catch {
    // Keep the existing application detail available before the migration is deployed.
  }
  const parsedInterview = application.interview
    ? readInterviewProposal(application.interview.notes)
    : null;
  return {
    ...application,
    interview: application.interview
      ? {
          ...application.interview,
          notes: parsedInterview?.notes,
          ...parsedInterview?.proposal,
        }
      : null,
    expectedSalaryRequestedAt,
  };
}

export async function submitRequestedExpectedSalary(
  userId: number,
  applicationId: number,
  expectedSalary: number,
) {
  const updated = await prisma.$queryRaw<
    Array<{ id: number; expectedSalary: number }>
  >(Prisma.sql`
    UPDATE "job_applications"
    SET "expectedSalary" = ${expectedSalary}, "updatedAt" = NOW()
    WHERE "id" = ${applicationId}
      AND "userId" = ${userId}
    RETURNING "id", "expectedSalary"
  `);
  if (!updated.length) throw new ApiError("Application was not found", 404);
  return updated[0];
}
