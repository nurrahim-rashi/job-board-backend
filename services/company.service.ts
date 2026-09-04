import { Prisma } from "../generated/prisma/client.js";
import { prisma } from "../lib/prisma.js";
import { ApiError } from "../utils/api-error.js";

export async function getPublicCompanies(options: { search?: string; city?: string; sort: "asc" | "desc" }) {
  const where: Prisma.CompanyWhereInput = {
    ...(options.search ? { companyName: { contains: options.search, mode: "insensitive" } } : {}),
    ...(options.city ? { city: { equals: options.city, mode: "insensitive" } } : {}),
  };
  return prisma.company.findMany({ where, orderBy: { companyName: options.sort }, select: { id: true, companyName: true, city: true, logo: true, profileContent: true, createdAt: true, _count: { select: { jobPostings: { where: { isPublished: true, deletedAt: null, deadline: { gte: new Date() } } } } } } });
}

export async function getPublicCompanyDetail(id: number) {
  const company = await prisma.company.findUnique({ where: { id }, select: { id: true, companyName: true, city: true, logo: true, phone: true, profileContent: true, createdAt: true, jobPostings: { where: { isPublished: true, deletedAt: null, deadline: { gte: new Date() } }, orderBy: { createdAt: "desc" }, select: { id: true, slug: true, title: true, cityLocation: true, category: true, salaryMin: true, salaryMax: true, createdAt: true, deadline: true } } } });
  if (!company) throw new ApiError("Company not found", 404);
  return company;
}
