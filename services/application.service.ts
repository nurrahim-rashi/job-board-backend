import { Prisma } from "../generated/prisma/client.js";
import { prisma } from "../lib/prisma.js";
import { ApiError } from "../utils/api-error.js";

const applicationInclude = {
  job: { select: { id: true, slug: true, title: true, cityLocation: true, category: true, salaryMin: true, salaryMax: true, deadline: true, company: { select: { id: true, companyName: true, logo: true } } } },
  interview: true,
} as const;

export async function createApplication(userId: number, slug: string, cvFile: Express.Multer.File, expectedSalary?: number) {
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { role: true, emailVerifiedAt: true } });
  if (!user || user.role !== "JOB_SEEKER") throw new ApiError("Only job seekers can apply", 403);
  if (!user.emailVerifiedAt) throw new ApiError("Verify your email before applying", 403);
  const job = await prisma.jobPosting.findFirst({ where: { slug, isPublished: true, deletedAt: null, deadline: { gte: new Date() } }, select: { id: true } });
  if (!job) throw new ApiError("Job is not available", 404);
  const duplicate = await prisma.jobApplication.findUnique({ where: { jobId_userId: { jobId: job.id, userId } } });
  if (duplicate) throw new ApiError("You have already applied for this job", 409);
  return prisma.jobApplication.create({ data: { jobId: job.id, userId, cvFile: `/uploads/cvs/${cvFile.filename}`, expectedSalary }, include: applicationInclude });
}

export async function getMyApplications(userId: number) {
  return prisma.jobApplication.findMany({ where: { userId }, include: applicationInclude, orderBy: { createdAt: "desc" } });
}

export async function getMyApplicationForJob(userId: number, slug: string) {
  return prisma.jobApplication.findFirst({
    where: { userId, job: { slug } },
    select: {
      id: true,
      status: true,
      createdAt: true,
      rejectionReason: true,
    },
  });
}

export async function getMyApplicationDetail(userId: number, applicationId: number) {
  const application = await prisma.jobApplication.findFirst({ where: { id: applicationId, userId }, include: applicationInclude });
  if (!application) throw new ApiError("Application not found", 404);
  let expectedSalaryRequestedAt: Date | null = null;
  try {
    const [request] = await prisma.$queryRaw<Array<{ expectedSalaryRequestedAt: Date | null }>>(Prisma.sql`
      SELECT "expectedSalaryRequestedAt"
      FROM "job_applications"
      WHERE "id" = ${applicationId}
    `);
    expectedSalaryRequestedAt = request?.expectedSalaryRequestedAt ?? null;
  } catch {
    // Keep the existing application detail available before the migration is deployed.
  }
  return { ...application, expectedSalaryRequestedAt };
}

export async function submitRequestedExpectedSalary(userId: number, applicationId: number, expectedSalary: number) {
  const updated = await prisma.$queryRaw<Array<{ id: number; expectedSalary: number }>>(Prisma.sql`
    UPDATE "job_applications"
    SET "expectedSalary" = ${expectedSalary}, "updatedAt" = NOW()
    WHERE "id" = ${applicationId}
      AND "userId" = ${userId}
      AND "expectedSalary" IS NULL
      AND "expectedSalaryRequestedAt" IS NOT NULL
    RETURNING "id", "expectedSalary"
  `);
  if (!updated.length) throw new ApiError("Expected salary request was not found or has already been answered", 400);
  return updated[0];
}
