import { prisma } from "../lib/prisma.js";
import { ApiError } from "../utils/api-error.js";

const savedJobSelect = {
  id: true,
  jobId: true,
  createdAt: true,
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
      salaryCurrency: true,
      deadline: true,
      isPublished: true,
      company: { select: { id: true, companyName: true, logo: true } },
    },
  },
} as const;

export async function saveJob(userId: number, slug: string) {
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

  const existing = await prisma.savedJob.findUnique({
    where: { jobId_userId: { jobId: job.id, userId } },
    select: { id: true, jobId: true, createdAt: true },
  });
  if (existing) return existing;

  return prisma.savedJob.create({
    data: { jobId: job.id, userId },
    select: { id: true, jobId: true, createdAt: true },
  });
}

export async function unsaveJob(userId: number, slug: string) {
  const saved = await prisma.savedJob.findFirst({
    where: { userId, job: { slug } },
    select: { id: true },
  });
  if (!saved) throw new ApiError("This job was not saved", 404);
  await prisma.savedJob.delete({ where: { id: saved.id } });
}

export async function getMySavedJobsPage(
  userId: number,
  page: number,
  limit: number,
) {
  const where = { userId, job: { deletedAt: null } } as const;
  const [items, total] = await Promise.all([
    prisma.savedJob.findMany({
      where,
      select: savedJobSelect,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.savedJob.count({ where }),
  ]);
  return {
    items,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.max(1, Math.ceil(total / limit)),
    },
  };
}

export async function getMySavedJobIds(userId: number) {
  const rows = await prisma.savedJob.findMany({
    where: { userId, job: { deletedAt: null } },
    select: { jobId: true },
  });
  return rows.map((row) => row.jobId);
}
