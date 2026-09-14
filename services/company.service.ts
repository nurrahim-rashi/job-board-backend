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
  const company = await prisma.company.findUnique({ where: { id }, select: { id: true, companyName: true, city: true, logo: true, phone: true, profileContent: true, tagline: true, size: true, founded: true, website: true, products: true, values: true, perks: true, createdAt: true, jobPostings: { where: { isPublished: true, deletedAt: null, deadline: { gte: new Date() } }, orderBy: { createdAt: "desc" }, select: { id: true, slug: true, title: true, cityLocation: true, category: true, salaryMin: true, salaryMax: true, createdAt: true, deadline: true } } } });
  if (!company) throw new ApiError("Company not found", 404);
  return company;
}

export async function getFollowedCompanies(userId: number) {
  const follows = await prisma.companyFollow.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
    select: {
      company: {
        select: {
          id: true,
          companyName: true,
          city: true,
          logo: true,
          profileContent: true,
          createdAt: true,
          _count: {
            select: {
              jobPostings: {
                where: {
                  isPublished: true,
                  deletedAt: null,
                  deadline: { gte: new Date() },
                },
              },
            },
          },
        },
      },
    },
  });
  return follows.map(({ company }) => company);
}

export async function followCompany(userId: number, companyId: number) {
  const company = await prisma.company.findUnique({
    where: { id: companyId },
    select: { id: true },
  });
  if (!company) throw new ApiError("Company not found", 404);
  await prisma.companyFollow.upsert({
    where: { userId_companyId: { userId, companyId } },
    create: { userId, companyId },
    update: {},
  });
}

export async function unfollowCompany(userId: number, companyId: number) {
  await prisma.companyFollow.deleteMany({ where: { userId, companyId } });
}
