import type { Prisma } from "../generated/prisma/client.js";
import type { JobCategory } from "../generated/prisma/enums.js";
import { prisma } from "../lib/prisma.js";
import type { AnalyticsQueryInput } from "../validators/analytics.validator.js";
import { calculateAge } from "./applicant.util.js";

const AGE_GROUPS = [
  { label: "Under 20", min: 0, max: 19 },
  { label: "20-24", min: 20, max: 24 },
  { label: "25-29", min: 25, max: 29 },
  { label: "30-34", min: 30, max: 34 },
  { label: "35-44", min: 35, max: 44 },
  { label: "45+", min: 45, max: 120 },
];

export interface MonthBucket {
  key: string;
  label: string;
}

export interface LabelCount {
  label: string;
  count: number;
}

export interface LabelAverage {
  label: string;
  average: number;
  samples: number;
}

export interface JobApplicationStat {
  jobId: number;
  title: string;
  slug: string;
  category: JobCategory;
  city: string;
  companyId: number;
  companyName: string;
  applications: number;
  salarySum: number;
  salarySamples: number;
}

export const rangeStart = (months: number): Date => {
  const now = new Date();

  return new Date(now.getFullYear(), now.getMonth() - (months - 1), 1);
};

export const previousRange = (months: number) => {
  const to = rangeStart(months);
  const from = new Date(to.getFullYear(), to.getMonth() - months, 1);

  return { gte: from, lt: to };
};

const monthKey = (date: Date): string =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;

export const buildMonthBuckets = (months: number): MonthBucket[] => {
  const start = rangeStart(months);

  return Array.from({ length: months }, (_, index) => {
    const date = new Date(start.getFullYear(), start.getMonth() + index, 1);

    return {
      key: monthKey(date),
      label: date.toLocaleDateString("en-GB", { month: "short" }),
    };
  });
};

export const countByMonth = (dates: Date[], buckets: MonthBucket[]) => {
  const counts = new Map(buckets.map((bucket) => [bucket.key, 0]));

  for (const date of dates) {
    const key = monthKey(date);
    const current = counts.get(key);

    if (current !== undefined) {
      counts.set(key, current + 1);
    }
  }

  return counts;
};

export const roundTo = (value: number, digits = 1): number => {
  const factor = 10 ** digits;

  return Math.round(value * factor) / factor;
};

export const percentage = (part: number, total: number): number =>
  total > 0 ? roundTo((part / total) * 100) : 0;

export const deltaPercent = (current: number, previous: number): number | null =>
  previous > 0 ? roundTo(((current - previous) / previous) * 100) : null;

export const average = (sum: number, samples: number): number | null =>
  samples > 0 ? Math.round(sum / samples) : null;

const normalizeLabel = (value: string | null): string | null => {
  const trimmed = value?.trim().replace(/\s+/g, " ");

  return trimmed ? trimmed : null;
};

export const mergeLabelCounts = (
  entries: Array<{ label: string | null; count: number }>,
): LabelCount[] => {
  const merged = new Map<string, LabelCount>();

  for (const entry of entries) {
    const label = normalizeLabel(entry.label);
    if (!label) continue;

    const key = label.toLowerCase();
    const current = merged.get(key);

    if (current) {
      current.count += entry.count;
    } else {
      merged.set(key, { label, count: entry.count });
    }
  }

  return [...merged.values()].sort((a, b) => b.count - a.count);
};

export const mergeLabelAverages = (
  entries: Array<{ label: string | null; sum: number; samples: number }>,
): LabelAverage[] => {
  const merged = new Map<string, { label: string; sum: number; samples: number }>();

  for (const entry of entries) {
    const label = normalizeLabel(entry.label);
    if (!label || entry.samples < 1) continue;

    const key = label.toLowerCase();
    const current = merged.get(key);

    if (current) {
      current.sum += entry.sum;
      current.samples += entry.samples;
    } else {
      merged.set(key, { label, sum: entry.sum, samples: entry.samples });
    }
  }

  return [...merged.values()]
    .map((entry) => ({
      label: entry.label,
      average: Math.round(entry.sum / entry.samples),
      samples: entry.samples,
    }))
    .sort((a, b) => b.average - a.average);
};

export const buildAgeGroups = (birthDates: Array<Date | null>) => {
  const ages = birthDates
    .map(calculateAge)
    .filter((age): age is number => age !== null && age >= 0);

  const groups = AGE_GROUPS.map((group) => {
    const count = ages.filter(
      (age) => age >= group.min && age <= group.max,
    ).length;

    return { label: group.label, count, share: percentage(count, ages.length) };
  });

  const totalAge = ages.reduce((total, age) => total + age, 0);

  return { groups, samples: ages.length, averageAge: average(totalAge, ages.length) };
};

export const buildApplicationWhere = (
  query: AnalyticsQueryInput,
): Prisma.JobApplicationWhereInput => ({
  status: { not: "DRAFT" },
  createdAt: { gte: rangeStart(query.months) },
  job: {
    deletedAt: null,
    ...(query.category && { category: query.category }),
  },
});

export const getJobApplicationStats = async (
  where: Prisma.JobApplicationWhereInput,
): Promise<JobApplicationStat[]> => {
  const grouped = await prisma.jobApplication.groupBy({
    by: ["jobId"],
    where,
    _count: { _all: true, expectedSalary: true },
    _sum: { expectedSalary: true },
  });

  if (!grouped.length) {
    return [];
  }

  const jobs = await prisma.jobPosting.findMany({
    where: { id: { in: grouped.map((row) => row.jobId) } },
    select: {
      id: true,
      title: true,
      slug: true,
      category: true,
      cityLocation: true,
      company: { select: { id: true, companyName: true } },
    },
  });

  const jobMap = new Map(jobs.map((job) => [job.id, job]));

  return grouped.flatMap((row) => {
    const job = jobMap.get(row.jobId);
    if (!job) return [];

    return [
      {
        jobId: job.id,
        title: job.title,
        slug: job.slug,
        category: job.category,
        city: job.cityLocation,
        companyId: job.company.id,
        companyName: job.company.companyName,
        applications: row._count._all,
        salarySum: row._sum.expectedSalary ?? 0,
        salarySamples: row._count.expectedSalary,
      },
    ];
  });
};
