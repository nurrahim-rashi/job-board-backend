import type { Prisma } from "../../generated/prisma/client.js";
import { prisma } from "../../lib/prisma.js";
import {
  buildApplicationWhere,
  getJobApplicationStats,
  mergeLabelCounts,
  percentage,
  roundTo,
} from "../../utils/analytics.util.js";
import type { AnalyticsQueryInput } from "../../validators/analytics.validator.js";

export const getApplicantInterestsService = async (query: AnalyticsQueryInput) => {
  const { category, limit } = query;
  const applicationWhere = buildApplicationWhere(query);

  const jobWhere: Prisma.JobPostingWhereInput = {
    deletedAt: null,
    isPublished: true,
    ...(category && { category }),
  };

  const [stats, jobGroups, applicants] = await Promise.all([
    getJobApplicationStats(applicationWhere),
    prisma.jobPosting.groupBy({
      by: ["category"],
      where: jobWhere,
      _count: { _all: true },
    }),
    prisma.jobApplication.findMany({
      where: applicationWhere,
      select: { userId: true },
      distinct: ["userId"],
    }),
  ]);

  const totalApplications = stats.reduce(
    (total, stat) => total + stat.applications,
    0,
  );

  const jobsByCategory = new Map(
    jobGroups.map((row) => [row.category, row._count._all]),
  );
  const applicationsByCategory = new Map<string, number>();

  for (const stat of stats) {
    applicationsByCategory.set(
      stat.category,
      (applicationsByCategory.get(stat.category) ?? 0) + stat.applications,
    );
  }

  const categories = [...jobsByCategory.keys()]
    .map((jobCategory) => {
      const applications = applicationsByCategory.get(jobCategory) ?? 0;
      const jobs = jobsByCategory.get(jobCategory) ?? 0;

      return {
        category: jobCategory,
        applications,
        jobs,
        share: percentage(applications, totalApplications),
        perJob: jobs > 0 ? roundTo(applications / jobs) : 0,
      };
    })
    .sort((a, b) => b.applications - a.applications);

  return {
    totalApplications,
    activeApplicants: applicants.length,
    applicationsPerApplicant:
      applicants.length > 0
        ? roundTo(totalApplications / applicants.length)
        : 0,
    categories,
    topJobs: [...stats]
      .sort((a, b) => b.applications - a.applications)
      .slice(0, limit)
      .map((stat) => ({
        slug: stat.slug,
        title: stat.title,
        companyName: stat.companyName,
        category: stat.category,
        city: stat.city,
        applications: stat.applications,
      })),
    cities: mergeLabelCounts(
      stats.map((stat) => ({ label: stat.city, count: stat.applications })),
    )
      .slice(0, limit)
      .map((entry) => ({
        ...entry,
        share: percentage(entry.count, totalApplications),
      })),
  };
};
