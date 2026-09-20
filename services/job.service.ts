import { JobCategory, Prisma } from "../generated/prisma/client.js";
import { prisma } from "../lib/prisma.js";
import { ApiError } from "../utils/api-error.js";
import { backfillActiveJobCoordinates } from "./geocoding.service.js";
import {
  getRegions,
  provinceSearchNames,
  reverseGeocodeCoordinates,
} from "./region.service.js";

export type JobListOptions = {
  latitude?: number;
  longitude?: number;
  province?: string;
  provinceCities?: string[];
  provinceName?: string;
  country?: string;
  city?: string;
  title?: string;
  category?: JobCategory;
  dateFrom?: Date;
  dateTo?: Date;
  sort?: "newest" | "oldest" | "nearest";
  limit: number;
};

const jobSelect = {
  id: true,
  slug: true,
  title: true,
  category: true,
  cityLocation: true,
  provinceLocation: true,
  countryLocation: true,
  latitude: true,
  longitude: true,
  salaryMin: true,
  salaryMax: true,
  salaryCurrency: true,
  tags: true,
  createdAt: true,
  deadline: true,
  company: { select: { id: true, companyName: true, logo: true, city: true } },
} satisfies Prisma.JobPostingSelect;

function distanceInKilometers(
  latitude: number,
  longitude: number,
  jobLatitude: number,
  jobLongitude: number,
) {
  const radians = (value: number) => (value * Math.PI) / 180;
  const value =
    Math.sin(radians(jobLatitude - latitude) / 2) ** 2 +
    Math.cos(radians(latitude)) *
      Math.cos(radians(jobLatitude)) *
      Math.sin(radians(jobLongitude - longitude) / 2) ** 2;
  return 6371 * 2 * Math.atan2(Math.sqrt(value), Math.sqrt(1 - value));
}

function publicWhere(options: JobListOptions): Prisma.JobPostingWhereInput {
  const city = options.city?.replace(
    /^(Kota Administrasi|Kabupaten|Kota)\s+/i,
    "",
  );
  const provinceCities = [
    ...new Set(
      (options.provinceCities ?? [])
        .map((name) =>
          name.replace(/^(Kota Administrasi|Kabupaten|Kota)\s+/i, "").trim(),
        )
        .filter(Boolean),
    ),
  ];
  const provinceNames = provinceSearchNames(options.provinceName);
  const combinedFilters: Prisma.JobPostingWhereInput[] = [
    ...(provinceNames.length
      ? [
          {
            OR: provinceNames.map((name) => ({
              provinceLocation: {
                contains: name,
                mode: "insensitive" as const,
              },
            })),
          },
        ]
      : []),
    ...(!city && provinceCities.length
      ? [
          {
            OR: provinceCities.map((name) => ({
              cityLocation: { contains: name, mode: "insensitive" as const },
            })),
          },
        ]
      : []),
    ...(options.title
      ? [
          {
            OR: [
              {
                title: {
                  contains: options.title,
                  mode: "insensitive" as const,
                },
              },
              {
                company: {
                  companyName: {
                    contains: options.title,
                    mode: "insensitive" as const,
                  },
                },
              },
            ],
          },
        ]
      : []),
  ];
  return {
    isPublished: true,
    deletedAt: null,
    deadline: { gte: new Date() },
    ...(city ? { cityLocation: { contains: city, mode: "insensitive" } } : {}),
    ...(options.country
      ? {
          countryLocation: {
            equals: options.country,
            mode: "insensitive",
          },
        }
      : {}),
    ...(combinedFilters.length ? { AND: combinedFilters } : {}),
    ...(options.category ? { category: options.category } : {}),
    ...(options.dateFrom || options.dateTo
      ? {
          createdAt: {
            ...(options.dateFrom ? { gte: options.dateFrom } : {}),
            ...(options.dateTo ? { lte: options.dateTo } : {}),
          },
        }
      : {}),
  };
}

export async function getPublicJobs(options: JobListOptions) {
  if (options.latitude !== undefined && options.longitude !== undefined) {
    await backfillActiveJobCoordinates();
    if (!options.country || !options.provinceName || !options.city) {
      try {
        const location = await reverseGeocodeCoordinates(
          options.latitude,
          options.longitude,
        );
        options.country ||= location.country;
        options.provinceName ||= location.province;
        options.city ||= location.city;
      } catch {
        // The browser also resolves the current country and retries the query.
      }
    }
  }
  const provinceCities =
    options.province && !options.city
      ? (
          (await getRegions(`regencies/${options.province}.json`)) as Array<{
            name?: string;
          }>
        ).map((region) => region.name ?? "")
      : undefined;
  const jobs = await prisma.jobPosting.findMany({
    where: publicWhere({ ...options, provinceCities }),
    select: jobSelect,
    orderBy: { createdAt: options.sort === "oldest" ? "asc" : "desc" },
  });
  if (options.latitude === undefined || options.longitude === undefined)
    return jobs.slice(0, options.limit);
  const nearbyJobs = jobs
    .map((job) => {
      const latitude = Number(job.latitude);
      const longitude = Number(job.longitude);
      const distance =
        job.latitude !== null &&
        job.longitude !== null &&
        Number.isFinite(latitude) &&
        Number.isFinite(longitude)
          ? distanceInKilometers(
              options.latitude!,
              options.longitude!,
              latitude,
              longitude,
            )
          : null;
      return { ...job, distance };
    })
    .filter((job) => job.distance !== null && job.distance <= 50);
  if (nearbyJobs.length === 0) {
    return jobs
      .map((job) => ({ ...job, distance: null }))
      .slice(0, options.limit);
  }
  return (
    options.sort === "nearest"
      ? nearbyJobs.sort(
          (first, second) =>
            first.distance! - second.distance! ||
            second.createdAt.getTime() - first.createdAt.getTime(),
        )
      : nearbyJobs
  ).slice(0, options.limit);
}

export async function getPublicJobDetail(slug: string) {
  const job = await prisma.jobPosting.findFirst({
    where: {
      slug,
      isPublished: true,
      deletedAt: null,
      deadline: { gte: new Date() },
    },
    include: {
      company: {
        select: {
          id: true,
          companyName: true,
          city: true,
          logo: true,
          profileContent: true,
          createdAt: true,
          user: { select: { id: true, name: true } },
        },
      },
      _count: { select: { applications: true } },
    },
  });
  if (!job) throw new ApiError("Job not found", 404);
  const relatedJobs = await prisma.jobPosting.findMany({
    where: {
      companyId: job.companyId,
      id: { not: job.id },
      isPublished: true,
      deletedAt: null,
      deadline: { gte: new Date() },
    },
    select: jobSelect,
    take: 3,
    orderBy: { createdAt: "desc" },
  });
  const { user, ...company } = job.company;
  return {
    ...job,
    company: {
      ...company,
      postedBy: { id: user.id, name: user.name || company.companyName },
    },
    applicantCount: job._count.applications,
    relatedJobs,
  };
}
