import { Prisma } from "../generated/prisma/client.js";
import { prisma } from "../lib/prisma.js";
import { ApiError } from "../utils/api-error.js";
import { backfillActiveJobCoordinates } from "./geocoding.service.js";

export async function getPublicCompanies(options: { search?: string; city?: string; sort: "asc" | "desc" | "nearest"; latitude?: number; longitude?: number }) {
  if (options.latitude !== undefined && options.longitude !== undefined) {
    await backfillActiveJobCoordinates();
  }
  const city = options.city?.replace(/^(Kota Administrasi|Kabupaten|Kota)\s+/i, "");
  const where: Prisma.CompanyWhereInput = {
    ...(options.search ? { companyName: { contains: options.search, mode: "insensitive" } } : {}),
    ...(city ? { city: { contains: city, mode: "insensitive" } } : {}),
  };
  const companies = await prisma.company.findMany({ where, orderBy: { companyName: options.sort === "desc" ? "desc" : "asc" }, select: { id: true, companyName: true, city: true, logo: true, profileContent: true, createdAt: true, jobPostings: { where: { isPublished: true, deletedAt: null, deadline: { gte: new Date() } }, select: { latitude: true, longitude: true } }, _count: { select: { jobPostings: { where: { isPublished: true, deletedAt: null, deadline: { gte: new Date() } } } } } } });
  if (options.latitude === undefined || options.longitude === undefined) return companies.map(({ jobPostings: _, ...company }) => company);
  const radians = (value: number) => value * Math.PI / 180;
  const distance = (lat: number, lng: number) => { const value = Math.sin(radians(lat - options.latitude!) / 2) ** 2 + Math.cos(radians(options.latitude!)) * Math.cos(radians(lat)) * Math.sin(radians(lng - options.longitude!) / 2) ** 2; return 6371 * 2 * Math.atan2(Math.sqrt(value), Math.sqrt(1 - value)); };
  const located = companies.map(({ jobPostings, ...company }) => ({ ...company, distance: jobPostings.filter((job) => job.latitude !== null && job.longitude !== null).map((job) => ({ lat: Number(job.latitude), lng: Number(job.longitude) })).filter((point) => Number.isFinite(point.lat) && Number.isFinite(point.lng)).map((point) => distance(point.lat, point.lng)).sort((a, b) => a - b)[0] ?? null })).filter((company) => company.distance !== null && company.distance <= 50).sort((a, b) => options.sort === "nearest" ? a.distance! - b.distance! : 0);
  return located.length ? located : companies.map(({ jobPostings: _, ...company }) => ({ ...company, distance: null }));
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
