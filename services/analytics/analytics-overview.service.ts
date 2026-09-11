import type { Prisma } from "../../generated/prisma/client.js";
import type { ApplicationStatus } from "../../generated/prisma/enums.js";
import { prisma } from "../../lib/prisma.js";
import {
  buildApplicationWhere,
  buildMonthBuckets,
  countByMonth,
  deltaPercent,
  percentage,
  previousRange,
  rangeStart,
  roundTo,
} from "../../utils/analytics.util.js";
import type { AnalyticsQueryInput } from "../../validators/analytics.validator.js";

const PIPELINE_ORDER: ApplicationStatus[] = [
  "PENDING",
  "TEST_ASSIGNED",
  "PROCESS",
  "INTERVIEW",
  "ACCEPTED",
  "REJECTED",
];

const buildMetric = (value: number, previous: number) => ({
  value,
  previous,
  delta: deltaPercent(value, previous),
});

export const getAnalyticsOverviewService = async (query: AnalyticsQueryInput) => {
  const { months, category } = query;
  const current = { gte: rangeStart(months) };
  const previous = previousRange(months);

  const applicationWhere = buildApplicationWhere(query);
  const previousApplicationWhere: Prisma.JobApplicationWhereInput = {
    ...applicationWhere,
    createdAt: previous,
  };

  const jobWhere: Prisma.JobPostingWhereInput = {
    deletedAt: null,
    isPublished: true,
    ...(category && { category }),
  };

  const interviewWhere: Prisma.InterviewWhereInput = {
    ...(category && { jobApplication: { job: { category } } }),
  };

  const [
    totalUsers,
    totalCompanies,
    totalJobs,
    jobSeekers,
    previousJobSeekers,
    companies,
    previousCompanies,
    jobs,
    previousJobs,
    applications,
    previousApplications,
    interviews,
    previousInterviews,
    hires,
    previousHires,
  ] = await Promise.all([
    prisma.user.count(),
    prisma.company.count(),
    prisma.jobPosting.count({ where: jobWhere }),
    prisma.user.count({ where: { role: "JOB_SEEKER", createdAt: current } }),
    prisma.user.count({ where: { role: "JOB_SEEKER", createdAt: previous } }),
    prisma.company.count({ where: { createdAt: current } }),
    prisma.company.count({ where: { createdAt: previous } }),
    prisma.jobPosting.count({ where: { ...jobWhere, createdAt: current } }),
    prisma.jobPosting.count({ where: { ...jobWhere, createdAt: previous } }),
    prisma.jobApplication.count({ where: applicationWhere }),
    prisma.jobApplication.count({ where: previousApplicationWhere }),
    prisma.interview.count({ where: { ...interviewWhere, createdAt: current } }),
    prisma.interview.count({ where: { ...interviewWhere, createdAt: previous } }),
    prisma.jobApplication.count({
      where: { ...applicationWhere, status: "ACCEPTED" },
    }),
    prisma.jobApplication.count({
      where: { ...previousApplicationWhere, status: "ACCEPTED" },
    }),
  ]);

  const [seekerDates, applicationDates, statusGroups] = await Promise.all([
    prisma.user.findMany({
      where: { role: "JOB_SEEKER", createdAt: current },
      select: { createdAt: true },
    }),
    prisma.jobApplication.findMany({
      where: applicationWhere,
      select: { createdAt: true },
    }),
    prisma.jobApplication.groupBy({
      by: ["status"],
      where: applicationWhere,
      _count: { _all: true },
    }),
  ]);

  const buckets = buildMonthBuckets(months);
  const seekersByMonth = countByMonth(
    seekerDates.map((row) => row.createdAt),
    buckets,
  );
  const applicationsByMonth = countByMonth(
    applicationDates.map((row) => row.createdAt),
    buckets,
  );

  const statusCounts = new Map(
    statusGroups.map((row) => [row.status, row._count._all]),
  );

  return {
    range: { months, from: current.gte, category: category ?? null },
    community: { totalUsers, totalCompanies, totalJobs },
    metrics: {
      jobSeekers: buildMetric(jobSeekers, previousJobSeekers),
      companies: buildMetric(companies, previousCompanies),
      jobs: buildMetric(jobs, previousJobs),
      applications: buildMetric(applications, previousApplications),
      interviews: buildMetric(interviews, previousInterviews),
      hires: buildMetric(hires, previousHires),
    },
    trend: buckets.map((bucket) => ({
      month: bucket.key,
      label: bucket.label,
      jobSeekers: seekersByMonth.get(bucket.key) ?? 0,
      applications: applicationsByMonth.get(bucket.key) ?? 0,
    })),
    pipeline: PIPELINE_ORDER.map((status) => {
      const count = statusCounts.get(status) ?? 0;

      return { status, count, share: percentage(count, applications) };
    }),
    applicationsPerJob: totalJobs > 0 ? roundTo(applications / totalJobs) : 0,
  };
};
