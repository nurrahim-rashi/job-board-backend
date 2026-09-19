import type { Prisma } from "../../generated/prisma/client.js";
import { JobCategory } from "../../generated/prisma/enums.js";
import { prisma } from "../../lib/prisma.js";
import {
  average,
  buildApplicationWhere,
  getJobApplicationStats,
  mergeLabelAverages,
  formatLocationLabel,
  rangeStart,
} from "../../utils/analytics.util.js";
import type { AnalyticsQueryInput } from "../../validators/analytics.validator.js";

const CATEGORY_ORDER = Object.values(JobCategory);

const postingMidpoint = (salaryMin: number | null, salaryMax: number | null) => {
  if (salaryMin !== null && salaryMax !== null) {
    return Math.round((salaryMin + salaryMax) / 2);
  }

  return salaryMin ?? salaryMax;
};

export const getSalaryTrendsService = async (query: AnalyticsQueryInput) => {
  const { months, category, limit } = query;
  const createdAt = { gte: rangeStart(months) };

  const jobWhere: Prisma.JobPostingWhereInput = {
    deletedAt: null,
    isPublished: true,
    createdAt,
    ...(category && { category }),
    OR: [{ salaryMin: { not: null } }, { salaryMax: { not: null } }],
  };

  const [applicationStats, postings, reviews] = await Promise.all([
    getJobApplicationStats(buildApplicationWhere(query)),
    prisma.jobPosting.findMany({
      where: jobWhere,
      select: { category: true, salaryMin: true, salaryMax: true },
    }),
    prisma.companyReview.findMany({
      where: { createdAt, salaryEstimate: { not: null } },
      select: {
        salaryEstimate: true,
        jobTitleHeld: true,
        company: { select: { city: true, province: true, country: true } },
      },
    }),
  ]);

  const expectedByCategory = new Map<string, { sum: number; samples: number }>();
  let expectedSum = 0;
  let expectedSamples = 0;

  for (const stat of applicationStats) {
    if (stat.salarySamples < 1) continue;

    const current = expectedByCategory.get(stat.category) ?? { sum: 0, samples: 0 };
    current.sum += stat.salarySum;
    current.samples += stat.salarySamples;
    expectedByCategory.set(stat.category, current);

    expectedSum += stat.salarySum;
    expectedSamples += stat.salarySamples;
  }

  const offeredByCategory = new Map<string, { sum: number; samples: number }>();
  let offeredSum = 0;
  let offeredSamples = 0;

  for (const posting of postings) {
    const midpoint = postingMidpoint(posting.salaryMin, posting.salaryMax);
    if (midpoint === null) continue;

    const current = offeredByCategory.get(posting.category) ?? { sum: 0, samples: 0 };
    current.sum += midpoint;
    current.samples += 1;
    offeredByCategory.set(posting.category, current);

    offeredSum += midpoint;
    offeredSamples += 1;
  }

  const reportedSum = reviews.reduce(
    (total, review) => total + (review.salaryEstimate ?? 0),
    0,
  );

  const byCategory = CATEGORY_ORDER.map((jobCategory) => {
    const expected = expectedByCategory.get(jobCategory);
    const offered = offeredByCategory.get(jobCategory);

    return {
      category: jobCategory,
      expected: expected ? average(expected.sum, expected.samples) : null,
      offered: offered ? average(offered.sum, offered.samples) : null,
      expectedSamples: expected?.samples ?? 0,
      offeredSamples: offered?.samples ?? 0,
    };
  }).filter((row) => row.expected !== null || row.offered !== null);

  return {
    expected: { average: average(expectedSum, expectedSamples), samples: expectedSamples },
    offered: { average: average(offeredSum, offeredSamples), samples: offeredSamples },
    reported: { average: average(reportedSum, reviews.length), samples: reviews.length },
    byCategory,
    byPosition: mergeLabelAverages(
      reviews.map((review) => ({
        label: review.jobTitleHeld,
        sum: review.salaryEstimate ?? 0,
        samples: 1,
      })),
    ).slice(0, limit),
    byLocation: mergeLabelAverages(
      reviews.map((review) => ({
        label: formatLocationLabel(
          review.company.city,
          review.company.province,
          review.company.country,
        ),
        sum: review.salaryEstimate ?? 0,
        samples: 1,
      })),
    ).slice(0, limit),
  };
};
