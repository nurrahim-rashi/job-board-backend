import { Prisma } from "../generated/prisma/client.js";
import { prisma } from "../lib/prisma.js";
import { ApiError } from "../utils/api-error.js";
import { createQualityBadge } from "../utils/quality-badge.util.js";
import { backfillActiveJobCoordinates } from "./geocoding.service.js";
import { getRegions, provinceSearchNames } from "./region.service.js";

type CompanyQualitySource = {
  companyName: string;
  phone: string;
  city: string;
  logo: string | null;
  profileContent: string;
  tagline: string;
  size: string;
  founded: number | null;
  website: string;
  user: { emailVerifiedAt: Date | null };
  jobPostings: Array<{
    salaryMin: number | null;
    salaryMax: number | null;
    description: string;
    cityLocation: string;
    deadline: Date;
    tags: unknown;
    banner: string | null;
  }>;
  reviews: Array<{
    ratingCulture: number;
    ratingWorkLife: number;
    ratingFacility: number;
    ratingCareer: number;
  }>;
};

type CompanyQualityApplication = {
  status: string;
  createdAt: Date;
  updatedAt: Date;
  interview: { status: string } | null;
};

function calculateCompanyQuality(
  company: CompanyQualitySource,
  applications: CompanyQualityApplication[],
) {
  const responded = applications.filter(
    (application) => application.status !== "PENDING",
  );
  const responseHours = responded
    .map((application) =>
      Math.max(
        0,
        (application.updatedAt.getTime() - application.createdAt.getTime()) /
          3_600_000,
      ),
    )
    .sort((left, right) => left - right);
  const responseDays = responseHours.map((hours) => hours / 24);
  const responseRate = applications.length
    ? Math.round((responded.length / applications.length) * 100)
    : null;
  const responseMiddle = Math.floor(responseHours.length / 2);
  const medianResponseHours = responseHours.length
    ? Math.round(
        responseHours.length % 2
          ? responseHours[responseMiddle]
          : (responseHours[responseMiddle - 1] +
              responseHours[responseMiddle]) /
              2,
      )
    : null;
  const interviews = applications.flatMap((application) =>
    application.interview ? [application.interview] : [],
  );
  const cancellationRate = interviews.length
    ? Math.round(
        (interviews.filter((interview) => interview.status === "CANCELLED")
          .length /
          interviews.length) *
          100,
      )
    : null;
  const hiringConversion = applications.length
    ? Math.round(
        (applications.filter((application) => application.status === "ACCEPTED")
          .length /
          applications.length) *
          100,
      )
    : null;
  const companyProfileFields = [
    company.companyName,
    company.phone,
    company.city,
    company.logo,
    company.profileContent,
    company.tagline,
    company.size,
    company.founded,
    company.website,
  ];
  const profileCompleteness = Math.round(
    (companyProfileFields.filter(Boolean).length /
      companyProfileFields.length) *
      100,
  );
  const transparency = company.jobPostings.length
    ? Math.round(
        company.jobPostings.reduce(
          (sum, job) =>
            sum +
            ([
              job.salaryMin !== null || job.salaryMax !== null,
              Boolean(job.description.trim()),
              Boolean(job.cityLocation.trim()),
              Boolean(job.deadline),
              Array.isArray(job.tags) && job.tags.length > 0,
              Boolean(job.banner),
            ].filter(Boolean).length /
              6) *
              100,
          0,
        ) / company.jobPostings.length,
      )
    : null;
  const employeeRating = company.reviews.length
    ? company.reviews.reduce(
        (sum, review) =>
          sum +
          (review.ratingCulture +
            review.ratingWorkLife +
            review.ratingFacility +
            review.ratingCareer) /
            4,
        0,
      ) / company.reviews.length
    : null;
  const employeeExperiencePercent =
    employeeRating === null ? null : Math.round((employeeRating / 5) * 100);
  const responseSpeedScore =
    medianResponseHours === null
      ? null
      : medianResponseHours <= 48
        ? 100
        : Math.max(0, Math.round(((168 - medianResponseHours) / 120) * 100));
  const qualityMetrics = [
    {
      key: "applicationResponse",
      label: "Application Response Rate",
      value: responseRate,
      score: responseRate,
      display: responseRate === null ? "—" : `${responseRate}%`,
      explanation: "Applications moved beyond Pending.",
    },
    {
      key: "firstResponseTime",
      label: "Median First Response Time",
      value: medianResponseHours,
      score: responseSpeedScore,
      display: medianResponseHours === null ? "—" : `${medianResponseHours}h`,
      explanation:
        "Median time between an application being submitted and the company's first recorded status action.",
    },
    {
      key: "interviewCancellation",
      label: "Interview Cancellation Rate",
      value: cancellationRate,
      score: cancellationRate === null ? null : 100 - cancellationRate,
      display: cancellationRate === null ? "—" : `${cancellationRate}%`,
      explanation:
        "Cancelled interviews divided by all scheduled interviews. This contribution is inverted: 0% cancellation contributes 100 quality points.",
    },
    {
      key: "hiringConversion",
      label: "Hiring Conversion Rate",
      value: hiringConversion,
      score: hiringConversion,
      display: hiringConversion === null ? "—" : `${hiringConversion}%`,
      explanation: "Accepted applicants divided by all valid applications.",
    },
    {
      key: "profileCompleteness",
      label: "Profile Completeness",
      value: profileCompleteness,
      score: profileCompleteness,
      display: `${profileCompleteness}%`,
      explanation:
        "Company identity, contact, description, branding, size, founding year, and website fields that are complete.",
    },
    {
      key: "jobTransparency",
      label: "Job Transparency Score",
      value: transparency,
      score: transparency,
      display: transparency === null ? "—" : `${transparency}%`,
      explanation:
        "Published jobs containing salary, description, location, deadline, tags, and banner.",
    },
    {
      key: "employeeExperience",
      label: "Employee Experience Rating",
      value: employeeExperiencePercent,
      score: employeeExperiencePercent,
      display:
        employeeExperiencePercent === null
          ? "—"
          : `${employeeExperiencePercent}%`,
      explanation:
        "Average culture, work-life, facility, and career rating, converted to a percentage.",
    },
  ];
  const availableQuality = qualityMetrics.filter(
    (metric) => metric.score !== null,
  );
  const score = availableQuality.length
    ? Math.min(
        100,
        Math.max(
          0,
          Math.round(
            availableQuality.reduce((sum, metric) => sum + metric.score!, 0) /
              availableQuality.length,
          ),
        ),
      )
      : 100;
  const profileBadgeTier =
    profileCompleteness >= 90
      ? "TOP"
      : profileCompleteness >= 70
        ? "MIDDLE"
        : "LOWER";
  const transparencyBadgeTier =
    transparency === null
      ? "UNRATED"
      : transparency >= 90
        ? "TOP"
        : transparency >= 70
          ? "MIDDLE"
          : "LOWER";
  const employeeExperienceTier =
    employeeExperiencePercent === null
      ? "UNRATED"
      : employeeExperiencePercent >= 90
        ? "TOP"
        : employeeExperiencePercent >= 70
          ? "MIDDLE"
          : "LOWER";
  const recruitmentSignals = [
    responseRate,
    cancellationRate === null ? null : 100 - cancellationRate,
    responseSpeedScore,
  ].filter((value): value is number => value !== null);
  const recruitmentScore = recruitmentSignals.length
    ? Math.round(
        recruitmentSignals.reduce((sum, value) => sum + value, 0) /
          recruitmentSignals.length,
      )
    : null;
  const recruitmentTier =
    recruitmentScore === null
      ? "UNRATED"
      : recruitmentScore >= 90
        ? "TOP"
        : recruitmentScore >= 70
          ? "MIDDLE"
          : "LOWER";
  const qualityBadges = [
    createQualityBadge(
      "companyProfileCompleteness",
      profileBadgeTier,
      `${profileCompleteness}% complete`,
      "Based on company identity, contact details, description, branding, size, founding year, and website.",
    ),
    createQualityBadge(
      "companyJobTransparency",
      transparencyBadgeTier,
      transparency === null ? "Not rated" : `${transparency}% transparent`,
      "Based on published jobs containing salary, description, location, deadline, tags, and banner.",
    ),
    createQualityBadge(
      "employeeExperience",
      employeeExperienceTier,
      employeeExperiencePercent === null
        ? "Not rated"
        : `${employeeExperiencePercent}% employee rating`,
      "Based on verified employee ratings for culture, work-life balance, facilities, and career growth.",
    ),
    createQualityBadge(
      "recruitmentProcess",
      recruitmentTier,
      recruitmentScore === null
        ? "Not rated"
        : `${recruitmentScore}% process reliability`,
      "Based on application responses, interview handling, and available response-time evidence. Missing signals are not counted.",
    ),
  ];
  return {
    quality: {
      score,
      metrics: qualityMetrics.map(({ score: _score, ...metric }) => metric),
      badges: qualityBadges,
    },
    responseDays,
    responseRate,
    hiringConversion,
  };
}

export async function getPublicCompanyQualityMap(companyIds: number[]) {
  const ids = [...new Set(companyIds.filter(Number.isInteger))];
  if (!ids.length) return new Map<number, ReturnType<typeof calculateCompanyQuality>["quality"]>();

  const [companies, applications] = await Promise.all([
    prisma.company.findMany({
      where: { id: { in: ids } },
      select: {
        id: true,
        companyName: true,
        phone: true,
        city: true,
        logo: true,
        profileContent: true,
        tagline: true,
        size: true,
        founded: true,
        website: true,
        user: { select: { emailVerifiedAt: true } },
        reviews: {
          select: {
            ratingCulture: true,
            ratingWorkLife: true,
            ratingFacility: true,
            ratingCareer: true,
          },
        },
        jobPostings: {
          where: {
            isPublished: true,
            deletedAt: null,
            deadline: { gte: new Date() },
          },
          select: {
            salaryMin: true,
            salaryMax: true,
            description: true,
            cityLocation: true,
            deadline: true,
            tags: true,
            banner: true,
          },
        },
      },
    }),
    prisma.jobApplication.findMany({
      where: {
        status: { not: "DRAFT" },
        job: { companyId: { in: ids } },
      },
      select: {
        status: true,
        createdAt: true,
        updatedAt: true,
        interview: { select: { status: true } },
        job: { select: { companyId: true } },
      },
    }),
  ]);

  const applicationsByCompany = new Map<number, CompanyQualityApplication[]>();
  for (const application of applications) {
    const current = applicationsByCompany.get(application.job.companyId) ?? [];
    current.push(application);
    applicationsByCompany.set(application.job.companyId, current);
  }

  return new Map(
    companies.map((company) => [
      company.id,
      calculateCompanyQuality(
        company,
        applicationsByCompany.get(company.id) ?? [],
      ).quality,
    ]),
  );
}

export async function getPublicCompanies(options: {
  search?: string;
  province?: string;
  provinceName?: string;
  country?: string;
  city?: string;
  sort: "asc" | "desc" | "nearest";
  latitude?: number;
  longitude?: number;
}) {
  if (options.latitude !== undefined && options.longitude !== undefined) {
    await backfillActiveJobCoordinates();
  }
  const city = options.city?.replace(
    /^(Kota Administrasi|Kabupaten|Kota)\s+/i,
    "",
  );
  const provinceCities =
    options.province && !options.city
      ? [
          ...new Set(
            (
              (await getRegions(
                `regencies/${options.province}.json`,
              )) as Array<{ name?: string }>
            )
              .map((region) =>
                (region.name ?? "")
                  .replace(/^(Kota Administrasi|Kabupaten|Kota)\s+/i, "")
                  .trim(),
              )
              .filter(Boolean),
          ),
        ]
      : [];
  const provinceNames = provinceSearchNames(options.provinceName);
  const where: Prisma.CompanyWhereInput = {
    ...(options.search
      ? { companyName: { contains: options.search, mode: "insensitive" } }
      : {}),
    ...(city ? { city: { contains: city, mode: "insensitive" } } : {}),
    ...(options.country
      ? { country: { equals: options.country, mode: "insensitive" } }
      : {}),
    ...(!city && provinceCities.length
      ? {
          OR: provinceCities.map((name) => ({
            city: { contains: name, mode: "insensitive" as const },
          })),
        }
      : {}),
    ...(!city && !provinceCities.length && provinceNames.length
      ? {
          OR: provinceNames.map((name) => ({
            province: {
              contains: name,
              mode: "insensitive" as const,
            },
          })),
        }
      : {}),
  };
  const companies = await prisma.company.findMany({
    where,
    orderBy: { companyName: options.sort === "desc" ? "desc" : "asc" },
    select: {
      id: true,
      companyName: true,
      city: true,
      province: true,
      country: true,
      logo: true,
      phone: true,
      profileContent: true,
      tagline: true,
      size: true,
      founded: true,
      website: true,
      createdAt: true,
      user: { select: { emailVerifiedAt: true } },
      reviews: {
        select: {
          ratingCulture: true,
          ratingWorkLife: true,
          ratingFacility: true,
          ratingCareer: true,
        },
      },
      jobPostings: {
        where: {
          isPublished: true,
          deletedAt: null,
          deadline: { gte: new Date() },
        },
        select: {
          latitude: true,
          longitude: true,
          salaryMin: true,
          salaryMax: true,
          description: true,
          cityLocation: true,
          deadline: true,
          tags: true,
          banner: true,
        },
      },
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
  });
  const companyApplications = companies.length
    ? await prisma.jobApplication.findMany({
        where: {
          status: { not: "DRAFT" },
          job: { companyId: { in: companies.map((company) => company.id) } },
        },
        select: {
          status: true,
          createdAt: true,
          updatedAt: true,
          interview: { select: { status: true } },
          job: { select: { companyId: true } },
        },
      })
    : [];
  const applicationsByCompany = new Map<
    number,
    CompanyQualityApplication[]
  >();
  for (const application of companyApplications) {
    const existing = applicationsByCompany.get(application.job.companyId) ?? [];
    existing.push(application);
    applicationsByCompany.set(application.job.companyId, existing);
  }
  const toPublicCompany = (
    company: (typeof companies)[number],
    distance?: number | null,
  ) => {
    const { jobPostings, reviews, user, ...publicCompany } = company;
    return {
      ...publicCompany,
      verified: Boolean(user.emailVerifiedAt),
      qualityScore: calculateCompanyQuality(
        { ...company, jobPostings, reviews },
        applicationsByCompany.get(company.id) ?? [],
      ).quality.score,
      ...(distance !== undefined ? { distance } : {}),
    };
  };
  if (options.latitude === undefined || options.longitude === undefined)
    return companies.map((company) => toPublicCompany(company));
  const radians = (value: number) => (value * Math.PI) / 180;
  const distance = (lat: number, lng: number) => {
    const value =
      Math.sin(radians(lat - options.latitude!) / 2) ** 2 +
      Math.cos(radians(options.latitude!)) *
        Math.cos(radians(lat)) *
        Math.sin(radians(lng - options.longitude!) / 2) ** 2;
    return 6371 * 2 * Math.atan2(Math.sqrt(value), Math.sqrt(1 - value));
  };
  const located = companies
    .map((company) => ({
      company,
      distance:
        company.jobPostings
          .filter((job) => job.latitude !== null && job.longitude !== null)
          .map((job) => ({
            lat: Number(job.latitude),
            lng: Number(job.longitude),
          }))
          .filter(
            (point) => Number.isFinite(point.lat) && Number.isFinite(point.lng),
          )
          .map((point) => distance(point.lat, point.lng))
          .sort((a, b) => a - b)[0] ?? null,
    }))
    .filter((company) => company.distance !== null && company.distance <= 50)
    .sort((a, b) =>
      options.sort === "nearest" ? a.distance! - b.distance! : 0,
    );
  return located.length
    ? located.map(({ company, distance }) => toPublicCompany(company, distance))
    : companies.map((company) => toPublicCompany(company, null));
}

export async function getPublicCompanyDetail(id: number, requesterId?: number) {
  const company = await prisma.company.findUnique({
    where: { id },
    select: {
      id: true,
      companyName: true,
      city: true,
      province: true,
      country: true,
      logo: true,
      phone: true,
      profileContent: true,
      tagline: true,
      size: true,
      founded: true,
      website: true,
      products: true,
      values: true,
      perks: true,
      createdAt: true,
      user: {
        select: {
          id: true,
          name: true,
          email: true,
          emailVerifiedAt: true,
          avatar: true,
          professionalRole: true,
        },
      },
      reviews: {
        select: {
          ratingCulture: true,
          ratingWorkLife: true,
          ratingFacility: true,
          ratingCareer: true,
        },
      },
      jobPostings: {
        where: {
          isPublished: true,
          deletedAt: null,
          deadline: { gte: new Date() },
        },
        orderBy: { createdAt: "desc" },
        select: {
          id: true,
          slug: true,
          title: true,
          description: true,
          banner: true,
          tags: true,
          cityLocation: true,
          provinceLocation: true,
          countryLocation: true,
          category: true,
          salaryMin: true,
          salaryMax: true,
          createdAt: true,
          deadline: true,
        },
      },
    },
  });
  if (!company) throw new ApiError("Company not found", 404);
  const applications = await prisma.jobApplication.findMany({
    where: { job: { companyId: id }, status: { not: "DRAFT" } },
    select: {
      status: true,
      createdAt: true,
      updatedAt: true,
      userId: true,
      interview: { select: { status: true, notes: true } },
      job: { select: { slug: true, title: true } },
    },
  });
  const { quality, responseDays, responseRate, hiringConversion } =
    calculateCompanyQuality(company, applications);
  const activeStatuses = new Set([
    "PENDING",
    "TEST_ASSIGNED",
    "PROCESS",
    "INTERVIEW",
  ]);
  const reliabilityPenalty = 0;
  const { reviews: _reviews, user: companyAdmin, ...publicCompany } = company;
  Object.assign(publicCompany, { companyAdmin });
  return {
    ...publicCompany,
    quality,
    metrics: {
      responseRate: responseRate ?? 0,
      acceptanceRate: hiringConversion ?? 0,
      reliabilityRate: Math.max(0, 100 - reliabilityPenalty),
      respondsWithinDays: responseDays.length
        ? Math.max(
            1,
            Math.round(
              responseDays.reduce((sum, days) => sum + days, 0) /
                responseDays.length,
            ),
          )
        : null,
    },
    viewerApplications: requesterId
      ? applications
          .filter(
            (application) =>
              application.userId === requesterId &&
              activeStatuses.has(application.status),
          )
          .map((application) => application.job)
      : [],
  };
}
