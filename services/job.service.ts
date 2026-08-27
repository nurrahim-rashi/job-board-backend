import { prisma } from "../lib/prisma.js";

type JobListOptions = {
  latitude?: number;
  longitude?: number;
  city?: string;
  limit: number;
};

const jobSelect = {
  id: true,
  slug: true,
  title: true,
  category: true,
  cityLocation: true,
  latitude: true,
  longitude: true,
  salaryMin: true,
  salaryMax: true,
  tags: true,
  createdAt: true,
  company: { select: { companyName: true, logo: true, city: true } },
} as const;

function distanceInKilometers(
  latitude: number,
  longitude: number,
  jobLatitude: number,
  jobLongitude: number,
) {
  const toRadians = (value: number) => (value * Math.PI) / 180;
  const earthRadius = 6371;
  const latitudeDelta = toRadians(jobLatitude - latitude);
  const longitudeDelta = toRadians(jobLongitude - longitude);
  const value =
    Math.sin(latitudeDelta / 2) ** 2 +
    Math.cos(toRadians(latitude)) *
      Math.cos(toRadians(jobLatitude)) *
      Math.sin(longitudeDelta / 2) ** 2;
  return earthRadius * 2 * Math.atan2(Math.sqrt(value), Math.sqrt(1 - value));
}

export async function getPublicJobs(options: JobListOptions) {
  const jobs = await prisma.jobPosting.findMany({
    where: {
      isPublished: true,
      deletedAt: null,
      deadline: { gte: new Date() },
      ...(options.city
        ? { cityLocation: { equals: options.city, mode: "insensitive" } }
        : {}),
    },
    select: jobSelect,
    orderBy: { createdAt: "desc" },
  });

  if (options.latitude === undefined || options.longitude === undefined)
    return jobs.slice(0, options.limit);

  return jobs
    .map((job) => {
      const jobLatitude = Number(job.latitude);
      const jobLongitude = Number(job.longitude);
      const distance =
        Number.isFinite(jobLatitude) && Number.isFinite(jobLongitude)
          ? distanceInKilometers(
              options.latitude!,
              options.longitude!,
              jobLatitude,
              jobLongitude,
            )
          : null;
      return { ...job, distance };
    })
    .filter((job) => job.distance !== null && job.distance <= 50)
    .sort(
      (first, second) =>
        first.distance! - second.distance! ||
        second.createdAt.getTime() - first.createdAt.getTime(),
    )
    .slice(0, options.limit);
}
