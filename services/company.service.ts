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

export async function getPublicCompanyDetail(id: number, requesterId?: number) {
  const company = await prisma.company.findUnique({ where: { id }, select: { id: true, companyName: true, city: true, logo: true, phone: true, profileContent: true, tagline: true, size: true, founded: true, website: true, products: true, values: true, perks: true, createdAt: true, user: { select: { id: true, name: true, email: true, avatar: true, professionalRole: true } }, reviews: { select: { ratingCulture: true, ratingWorkLife: true, ratingFacility: true, ratingCareer: true } }, jobPostings: { where: { isPublished: true, deletedAt: null, deadline: { gte: new Date() } }, orderBy: { createdAt: "desc" }, select: { id: true, slug: true, title: true, description: true, banner: true, tags: true, cityLocation: true, category: true, salaryMin: true, salaryMax: true, createdAt: true, deadline: true } } } });
  if (!company) throw new ApiError("Company not found", 404);
  const applications = await prisma.jobApplication.findMany({ where: { job: { companyId: id }, status: { not: "DRAFT" } }, select: { status: true, createdAt: true, updatedAt: true, userId: true, interview: { select: { status: true, notes: true } }, job: { select: { slug: true, title: true } } } });
  const responded = applications.filter((application) => application.status !== "PENDING");
  const responseDays = responded.map((application) => Math.max(0, (application.updatedAt.getTime() - application.createdAt.getTime()) / 86_400_000));
  const activeStatuses = new Set(["PENDING", "TEST_ASSIGNED", "PROCESS", "INTERVIEW"]);
  const reliabilityPenalty = 0;
  const responseRate = applications.length ? Math.round(responded.length / applications.length * 100) : null;
  // A first-response timestamp cannot be reconstructed safely from updatedAt,
  // because salary and other edits also update it. Keep this metric unavailable
  // until application status history is recorded.
  const medianResponseHours: number | null = null;
  const interviews = applications.flatMap((application) => application.interview ? [application.interview] : []);
  const cancellationRate = interviews.length ? Math.round(interviews.filter((interview) => interview.status === "CANCELLED").length / interviews.length * 100) : null;
  const hiringConversion = applications.length ? Math.round(applications.filter((application) => application.status === "ACCEPTED").length / applications.length * 100) : null;
  const companyProfileFields = [company.companyName, company.phone, company.city, company.logo, company.profileContent, company.tagline, company.size, company.founded, company.website];
  const profileCompleteness = Math.round(companyProfileFields.filter(Boolean).length / companyProfileFields.length * 100);
  const transparency = company.jobPostings.length ? Math.round(company.jobPostings.reduce((sum, job) => sum + [job.salaryMin !== null || job.salaryMax !== null, Boolean(job.description.trim()), Boolean(job.cityLocation.trim()), Boolean(job.deadline), Array.isArray(job.tags) && job.tags.length > 0, Boolean(job.banner)].filter(Boolean).length / 6 * 100, 0) / company.jobPostings.length) : null;
  const employeeRating = company.reviews.length ? company.reviews.reduce((sum, review) => sum + (review.ratingCulture + review.ratingWorkLife + review.ratingFacility + review.ratingCareer) / 4, 0) / company.reviews.length : null;
  const responseSpeedScore = medianResponseHours === null ? null : medianResponseHours <= 48 ? 100 : Math.max(0, Math.round((168 - medianResponseHours) / 120 * 100));
  const qualityMetrics = [
    { key: "applicationResponse", label: "Application Response Rate", value: responseRate, score: responseRate, display: responseRate === null ? "—" : `${responseRate}%`, explanation: "Applications moved beyond Pending." },
    { key: "firstResponseTime", label: "Median First Response Time", value: medianResponseHours, score: responseSpeedScore, display: medianResponseHours === null ? "—" : `${medianResponseHours}h`, explanation: "Median time between an application being submitted and the company's first recorded status action." },
    { key: "interviewCancellation", label: "Interview Cancellation Rate", value: cancellationRate, score: cancellationRate === null ? null : 100 - cancellationRate, display: cancellationRate === null ? "—" : `${cancellationRate}%`, explanation: "Cancelled interviews divided by all scheduled interviews. This contribution is inverted: 0% cancellation contributes 100 quality points." },
    { key: "hiringConversion", label: "Hiring Conversion Rate", value: hiringConversion, score: hiringConversion, display: hiringConversion === null ? "—" : `${hiringConversion}%`, explanation: "Accepted applicants divided by all valid applications." },
    { key: "profileCompleteness", label: "Profile Completeness", value: profileCompleteness, score: profileCompleteness, display: `${profileCompleteness}%`, explanation: "Company identity, contact, description, branding, size, founding year, and website fields that are complete." },
    { key: "jobTransparency", label: "Job Transparency Score", value: transparency, score: transparency, display: transparency === null ? "—" : `${transparency}%`, explanation: "Published jobs containing salary, description, location, deadline, tags, and banner." },
    { key: "employeeExperience", label: "Employee Experience Rating", value: employeeRating, score: employeeRating === null ? null : employeeRating / 5 * 100, display: employeeRating === null ? "—" : `${employeeRating.toFixed(1)}/5`, explanation: "Average culture, work-life, facility, and career rating." },
  ];
  const availableQuality = qualityMetrics.filter((metric) => metric.score !== null);
  const qualityScore = availableQuality.length ? Math.min(100, Math.max(0, Math.round(availableQuality.reduce((sum, metric) => sum + metric.score!, 0) / availableQuality.length))) : 100;
  const { reviews: _reviews, user: companyAdmin, ...publicCompany } = company;
  Object.assign(publicCompany, { companyAdmin });
  return { ...publicCompany, quality: { score: qualityScore, metrics: qualityMetrics.map(({ score: _score, ...metric }) => metric) }, metrics: { responseRate: responseRate ?? 0, acceptanceRate: hiringConversion ?? 0, reliabilityRate: Math.max(0, 100 - reliabilityPenalty), respondsWithinDays: responseDays.length ? Math.max(1, Math.round(responseDays.reduce((sum, days) => sum + days, 0) / responseDays.length)) : null }, viewerApplications: requesterId ? applications.filter((application) => application.userId === requesterId && activeStatuses.has(application.status)).map((application) => application.job) : [] };
}
