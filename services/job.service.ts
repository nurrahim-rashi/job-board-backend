import { JobCategory, Prisma } from "../generated/prisma/client.js";
import { prisma } from "../lib/prisma.js";
import { ApiError } from "../utils/api-error.js";

export type JobListOptions = { latitude?: number; longitude?: number; city?: string; title?: string; category?: JobCategory; dateFrom?: Date; dateTo?: Date; sort?: "newest" | "oldest" | "nearest"; limit: number };

const jobSelect = { id: true, slug: true, title: true, category: true, cityLocation: true, latitude: true, longitude: true, salaryMin: true, salaryMax: true, tags: true, createdAt: true, deadline: true, company: { select: { id: true, companyName: true, logo: true, city: true } } } satisfies Prisma.JobPostingSelect;

function distanceInKilometers(latitude: number, longitude: number, jobLatitude: number, jobLongitude: number) {
  const radians = (value: number) => (value * Math.PI) / 180;
  const value = Math.sin(radians(jobLatitude - latitude) / 2) ** 2 + Math.cos(radians(latitude)) * Math.cos(radians(jobLatitude)) * Math.sin(radians(jobLongitude - longitude) / 2) ** 2;
  return 6371 * 2 * Math.atan2(Math.sqrt(value), Math.sqrt(1 - value));
}

function publicWhere(options: JobListOptions): Prisma.JobPostingWhereInput {
  return {
    isPublished: true, deletedAt: null, deadline: { gte: new Date() },
    ...(options.city ? { cityLocation: { equals: options.city, mode: "insensitive" } } : {}),
    ...(options.title ? { OR: [{ title: { contains: options.title, mode: "insensitive" } }, { company: { companyName: { contains: options.title, mode: "insensitive" } } }] } : {}),
    ...(options.category ? { category: options.category } : {}),
    ...(options.dateFrom || options.dateTo ? { createdAt: { ...(options.dateFrom ? { gte: options.dateFrom } : {}), ...(options.dateTo ? { lte: options.dateTo } : {}) } } : {}),
  };
}

export async function getPublicJobs(options: JobListOptions) {
  const jobs = await prisma.jobPosting.findMany({ where: publicWhere(options), select: jobSelect, orderBy: { createdAt: options.sort === "oldest" ? "asc" : "desc" } });
  if (options.latitude === undefined || options.longitude === undefined) return jobs.slice(0, options.limit);
  const nearbyJobs = jobs.map((job) => {
    const latitude = Number(job.latitude); const longitude = Number(job.longitude);
    const distance = Number.isFinite(latitude) && Number.isFinite(longitude) ? distanceInKilometers(options.latitude!, options.longitude!, latitude, longitude) : null;
    return { ...job, distance };
  }).filter((job) => job.distance !== null && job.distance <= 50);
  return (options.sort === "nearest" ? nearbyJobs.sort((first, second) => first.distance! - second.distance! || second.createdAt.getTime() - first.createdAt.getTime()) : nearbyJobs).slice(0, options.limit);
}

export async function getPublicJobDetail(slug: string) {
  const job = await prisma.jobPosting.findFirst({ where: { slug, isPublished: true, deletedAt: null, deadline: { gte: new Date() } }, include: { company: { select: { id: true, companyName: true, city: true, logo: true, profileContent: true, createdAt: true } }, _count: { select: { applications: true } } } });
  if (!job) throw new ApiError("Job not found", 404);
  const relatedJobs = await prisma.jobPosting.findMany({ where: { companyId: job.companyId, id: { not: job.id }, isPublished: true, deletedAt: null, deadline: { gte: new Date() } }, select: jobSelect, take: 3, orderBy: { createdAt: "desc" } });
  return { ...job, applicantCount: job._count.applications, relatedJobs };
}
