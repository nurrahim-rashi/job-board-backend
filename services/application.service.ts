import { prisma } from "../lib/prisma.js";
import { ApiError } from "../utils/api-error.js";

const applicationInclude = {
  job: { select: { id: true, slug: true, title: true, cityLocation: true, category: true, company: { select: { id: true, companyName: true, logo: true } } } },
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

export async function getMyApplicationDetail(userId: number, applicationId: number) {
  const application = await prisma.jobApplication.findFirst({ where: { id: applicationId, userId }, include: applicationInclude });
  if (!application) throw new ApiError("Application not found", 404);
  return application;
}
