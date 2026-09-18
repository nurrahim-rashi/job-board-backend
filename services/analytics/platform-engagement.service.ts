import type { InterviewStatus } from "../../generated/prisma/enums.js";
import { prisma } from "../../lib/prisma.js";
import {
  buildApplicationWhere,
  getJobApplicationStats,
  percentage,
  rangeStart,
  roundTo,
} from "../../utils/analytics.util.js";
import type { AnalyticsQueryInput } from "../../validators/analytics.validator.js";

const INTERVIEW_ORDER: InterviewStatus[] = ["SCHEDULED", "COMPLETED", "CANCELLED"];

const sumByCompany = (
  stats: Array<{ companyId: number; applications: number }>,
) => {
  const totals = new Map<number, number>();

  for (const stat of stats) {
    totals.set(stat.companyId, (totals.get(stat.companyId) ?? 0) + stat.applications);
  }

  return totals;
};

const averageRating = (values: Array<number | null>) => {
  const ratings = values.filter((value): value is number => value !== null);

  if (!ratings.length) {
    return null;
  }

  return roundTo(
    ratings.reduce((total, value) => total + value, 0) / ratings.length,
    2,
  );
};

export const getPlatformEngagementService = async (query: AnalyticsQueryInput) => {
  const { months, category, limit } = query;
  const createdAt = { gte: rangeStart(months) };
  const applicationWhere = buildApplicationWhere(query);

  const [stats, hireStats] = await Promise.all([
    getJobApplicationStats(applicationWhere),
    getJobApplicationStats({ ...applicationWhere, status: "ACCEPTED" }),
  ]);

  const applicationsByCompany = sumByCompany(stats);
  const hiresByCompany = sumByCompany(hireStats);

  const topCompanyIds = [...applicationsByCompany.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([companyId]) => companyId);

  const [
    companies,
    companyJobGroups,
    subscriptionGroups,
    plans,
    assessmentGroups,
    assessments,
    testJobs,
    publishedJobs,
    testResults,
    interviewGroups,
    reviewStats,
  ] = await Promise.all([
    prisma.company.findMany({
      where: { id: { in: topCompanyIds } },
      select: {
        id: true,
        companyName: true,
        city: true,
        province: true,
        country: true,
      },
    }),
    prisma.jobPosting.groupBy({
      by: ["companyId"],
      where: {
        companyId: { in: topCompanyIds },
        deletedAt: null,
        isPublished: true,
        ...(category && { category }),
      },
      _count: { _all: true },
    }),
    prisma.userSubscription.groupBy({
      by: ["subscriptionId", "status"],
      where: { createdAt },
      _count: { _all: true },
    }),
    prisma.subscription.findMany({ select: { id: true, name: true, price: true } }),
    prisma.skillAssessmentResult.groupBy({
      by: ["assessmentId", "isPassed"],
      where: { createdAt },
      _count: { _all: true },
      _avg: { score: true },
    }),
    prisma.skillAssessment.findMany({ select: { id: true, title: true, skillName: true } }),
    prisma.jobPosting.count({
      where: { deletedAt: null, hasPreSelectionTest: true, ...(category && { category }) },
    }),
    prisma.jobPosting.count({
      where: { deletedAt: null, isPublished: true, ...(category && { category }) },
    }),
    prisma.applicantTestResult.findMany({
      where: { createdAt, ...(category && { job: { category } }) },
      select: { score: true, submittedAt: true },
    }),
    prisma.interview.groupBy({
      by: ["status"],
      where: {
        createdAt,
        ...(category && { jobApplication: { job: { category } } }),
      },
      _count: { _all: true },
    }),
    prisma.companyReview.aggregate({
      where: { createdAt },
      _count: { _all: true },
      _avg: {
        ratingCulture: true,
        ratingWorkLife: true,
        ratingFacility: true,
        ratingCareer: true,
      },
    }),
  ]);

  const companyMap = new Map(companies.map((company) => [company.id, company]));
  const jobsByCompany = new Map(
    companyJobGroups.map((row) => [row.companyId, row._count._all]),
  );
  const subscriptions = plans.map((plan) => {
    const rows = subscriptionGroups.filter((row) => row.subscriptionId === plan.id);
    const countOf = (status: string) =>
      rows.find((row) => row.status === status)?._count._all ?? 0;

    const active = countOf("ACTIVE");

    return {
      plan: plan.name,
      price: plan.price,
      active,
      pending: countOf("PENDING_APPROVAL"),
      expired: countOf("EXPIRED"),
      revenue: active * plan.price,
    };
  });

  const submitted = testResults.filter((result) => result.submittedAt !== null);
  const scoreSum = submitted.reduce((total, result) => total + (result.score ?? 0), 0);

  const interviewCounts = new Map(
    interviewGroups.map((row) => [row.status, row._count._all]),
  );

  const ratings = reviewStats._avg;

  return {
    topCompanies: topCompanyIds.flatMap((companyId) => {
      const company = companyMap.get(companyId);
      if (!company) return [];

      const applications = applicationsByCompany.get(companyId) ?? 0;
      const hires = hiresByCompany.get(companyId) ?? 0;

      return [
        {
          id: company.id,
          companyName: company.companyName,
          city: company.city,
          province: company.province,
          country: company.country,
          jobs: jobsByCompany.get(companyId) ?? 0,
          applications,
          hires,
          hireRate: percentage(hires, applications),
        },
      ];
    }),
    subscriptions,
    assessments: assessments
      .map((assessment) => {
        const rows = assessmentGroups.filter(
          (row) => row.assessmentId === assessment.id,
        );
        const attempts = rows.reduce((total, row) => total + row._count._all, 0);
        const passed = rows
          .filter((row) => row.isPassed)
          .reduce((total, row) => total + row._count._all, 0);
        const scoreTotal = rows.reduce(
          (total, row) => total + (row._avg.score ?? 0) * row._count._all,
          0,
        );

        return {
          title: assessment.title,
          skillName: assessment.skillName,
          attempts,
          passRate: percentage(passed, attempts),
          averageScore: attempts > 0 ? Math.round(scoreTotal / attempts) : null,
        };
      })
      .filter((row) => row.attempts > 0)
      .sort((a, b) => b.attempts - a.attempts)
      .slice(0, limit),
    preSelection: {
      jobsWithTest: testJobs,
      publishedJobs,
      adoptionRate: percentage(testJobs, publishedJobs),
      attempts: testResults.length,
      submitted: submitted.length,
      completionRate: percentage(submitted.length, testResults.length),
      averageScore: submitted.length > 0 ? Math.round(scoreSum / submitted.length) : null,
    },
    interviews: INTERVIEW_ORDER.map((status) => ({
      status,
      count: interviewCounts.get(status) ?? 0,
    })),
    reviews: {
      total: reviewStats._count._all,
      overall: averageRating([
        ratings.ratingCulture,
        ratings.ratingWorkLife,
        ratings.ratingFacility,
        ratings.ratingCareer,
      ]),
      breakdown: [
        { label: "Culture", value: averageRating([ratings.ratingCulture]) },
        { label: "Work life", value: averageRating([ratings.ratingWorkLife]) },
        { label: "Facility", value: averageRating([ratings.ratingFacility]) },
        { label: "Career", value: averageRating([ratings.ratingCareer]) },
      ],
    },
  };
};
