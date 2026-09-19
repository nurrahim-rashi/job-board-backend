import { prisma } from "../lib/prisma.js";
import { ApiError } from "../utils/api-error.js";
import { getPublicCompanyQualityMap } from "./company.service.js";

type CreateReviewData = {
  salaryEstimate?: number;
  ratingCulture: number;
  ratingWorkLife: number;
  ratingFacility: number;
  ratingCareer: number;
  reviewText: string;
};

const publicReviewSelect = {
  id: true,
  jobTitleHeld: true,
  salaryEstimate: true,
  ratingCulture: true,
  ratingWorkLife: true,
  ratingFacility: true,
  ratingCareer: true,
  reviewText: true,
  createdAt: true,
} as const;

const reviewScore = (review: {
  ratingCulture: number;
  ratingWorkLife: number;
  ratingFacility: number;
  ratingCareer: number;
}) =>
  (review.ratingCulture +
    review.ratingWorkLife +
    review.ratingFacility +
    review.ratingCareer) /
  4;

const oneDecimal = (value: number) => Math.round(value * 10) / 10;

export const getReviewStoriesService = async () => {
  const [reviews, acceptedApplications, rejectedApplications, publishedJobs, transparentJobs, ratings] =
    await Promise.all([
      prisma.companyReview.findMany({
        orderBy: { createdAt: "desc" },
        select: {
          ...publicReviewSelect,
          company: {
            select: {
              id: true,
              companyName: true,
              logo: true,
              city: true,
              province: true,
              country: true,
              user: { select: { emailVerifiedAt: true } },
            },
          },
        },
      }),
      prisma.jobApplication.findMany({
        where: { status: "ACCEPTED" },
        select: {
          createdAt: true,
          updatedAt: true,
          job: { select: { companyId: true, title: true, tags: true } },
          user: {
            select: {
              assessmentResults: {
                where: { isPassed: true },
                select: {
                  id: true,
                  assessment: { select: { skillName: true } },
                },
              },
            },
          },
          userId: true,
        },
      }),
      prisma.jobApplication.findMany({
        where: { status: "REJECTED" },
        select: { rejectionReason: true },
      }),
      prisma.jobPosting.count({
        where: { isPublished: true, deletedAt: null },
      }),
      prisma.jobPosting.count({
        where: {
          isPublished: true,
          deletedAt: null,
          salaryMin: { not: null },
          salaryMax: { not: null },
        },
      }),
      prisma.companyReview.aggregate({
        _count: { id: true },
        _avg: {
          ratingCulture: true,
          ratingWorkLife: true,
          ratingFacility: true,
          ratingCareer: true,
        },
      }),
    ]);

  const hireDurations = acceptedApplications
    .map(
      ({ createdAt, updatedAt }) =>
        (updatedAt.getTime() - createdAt.getTime()) / (1000 * 60 * 60 * 24),
    )
    .sort((left, right) => left - right);
  const middle = Math.floor(hireDurations.length / 2);
  const medianDaysToOffer = hireDurations.length
    ? oneDecimal(
        hireDurations.length % 2
          ? hireDurations[middle]
          : (hireDurations[middle - 1] + hireDurations[middle]) / 2,
      )
    : null;

  const ratingValues = [
    ratings._avg.ratingCulture,
    ratings._avg.ratingWorkLife,
    ratings._avg.ratingFacility,
    ratings._avg.ratingCareer,
  ].filter((value): value is number => value !== null);
  const averageReviewRating = ratingValues.length
    ? oneDecimal(
        ratingValues.reduce((total, value) => total + value, 0) /
          ratingValues.length,
      )
    : null;

  const companyGroups = new Map<
    number,
    {
      company: (typeof reviews)[number]["company"];
      reviewCount: number;
      totalRating: number;
      latestReview: (typeof reviews)[number];
      latestReviews: Array<(typeof reviews)[number]>;
    }
  >();

  for (const review of reviews) {
    const existing = companyGroups.get(review.company.id);
    if (existing) {
      existing.reviewCount += 1;
      existing.totalRating += reviewScore(review);
      if (existing.latestReviews.length < 3) existing.latestReviews.push(review);
    } else {
      companyGroups.set(review.company.id, {
        company: review.company,
        reviewCount: 1,
        totalRating: reviewScore(review),
        latestReview: review,
        latestReviews: [review],
      });
    }
  }

  const qualityByCompanyId = await getPublicCompanyQualityMap([
    ...companyGroups.keys(),
  ]);
  const verifiedHiresByCompany = new Map<number, Set<number>>();
  for (const application of acceptedApplications) {
    const tags = Array.isArray(application.job.tags)
      ? application.job.tags.filter(
          (tag): tag is string => typeof tag === "string",
        )
      : [];
    const roleSignals = `${application.job.title} ${tags.join(" ")}`.toLowerCase();
    const hasRelevantBadge = application.user.assessmentResults.some(
      ({ assessment }) => {
        const skill = assessment.skillName.trim().toLowerCase();
        return skill.length > 0 && roleSignals.includes(skill);
      },
    );
    if (!hasRelevantBadge) continue;
    const existing =
      verifiedHiresByCompany.get(application.job.companyId) ?? new Set<number>();
    existing.add(application.userId);
    verifiedHiresByCompany.set(application.job.companyId, existing);
  }
  const publicStoryCompany = (company: (typeof reviews)[number]["company"]) => {
    const { user, ...publicCompany } = company;
    return { ...publicCompany, verified: Boolean(user.emailVerifiedAt) };
  };

  return {
    reviews: reviews.map((review) => ({
      ...review,
      company: publicStoryCompany(review.company),
      overallRating: oneDecimal(reviewScore(review)),
    })),
    companies: [...companyGroups.values()]
      .map(({ company, reviewCount, totalRating, latestReview, latestReviews }) => {
        return {
          company: publicStoryCompany(company),
          reviewCount,
          averageRating: oneDecimal(totalRating / reviewCount),
          verifiedSkillHires:
            verifiedHiresByCompany.get(company.id)?.size ?? 0,
          quality:
            qualityByCompanyId.get(company.id) ?? {
              score: 100,
              metrics: [],
              badges: [],
            },
          latestReviews: latestReviews.map((review) => ({
            id: review.id,
            jobTitleHeld: review.jobTitleHeld,
            reviewText: review.reviewText,
            overallRating: oneDecimal(reviewScore(review)),
            createdAt: review.createdAt,
          })),
          latestReview: {
            id: latestReview.id,
            jobTitleHeld: latestReview.jobTitleHeld,
            reviewText: latestReview.reviewText,
            createdAt: latestReview.createdAt,
          },
        };
      })
      .sort((left, right) =>
        right.latestReview.createdAt.getTime() -
        left.latestReview.createdAt.getTime(),
      ),
    metrics: {
      matchesMade: acceptedApplications.length,
      medianDaysToOffer,
      salaryTransparencyRate: publishedJobs
        ? Math.round((transparentJobs / publishedJobs) * 100)
        : null,
      averageReviewRating,
      totalReviews: ratings._count.id,
      rejectedWithReasonRate: rejectedApplications.length
        ? Math.round(
            (rejectedApplications.filter(
              ({ rejectionReason }) => Boolean(rejectionReason?.trim()),
            ).length /
              rejectedApplications.length) *
              100,
          )
        : null,
    },
  };
};

async function ensureCompanyExists(companyId: number) {
  const company = await prisma.company.findUnique({
    where: { id: companyId },
    select: { id: true },
  });

  if (!company) {
    throw new ApiError("Company not found", 404);
  }
}

export const getCompanyReviewsService = async (
  companyId: number,
  viewerId?: number,
) => {
  await ensureCompanyExists(companyId);

  const reviews = await prisma.companyReview.findMany({
    where: { companyId },
    orderBy: { createdAt: "desc" },
    select: publicReviewSelect,
  });

  let viewer = {
    canReview: false,
    hasReviewed: false,
    jobTitleHeld: null as string | null,
  };

  if (viewerId) {
    const [employment, existingReview] = await Promise.all([
      prisma.jobApplication.findFirst({
        where: {
          userId: viewerId,
          job: { companyId },
          status: "ACCEPTED",
        },
        orderBy: { updatedAt: "desc" },
        select: {
          job: {
            select: {
              title: true,
            },
          },
        },
      }),
      prisma.companyReview.findFirst({
        where: {
          userId: viewerId,
          companyId,
        },
        select: { id: true },
      }),
    ]);

    viewer = {
      canReview: Boolean(employment) && !existingReview,
      hasReviewed: Boolean(existingReview),
      jobTitleHeld: employment?.job.title ?? null,
    };
  }

  return {
    reviews,
    viewer,
  };
};

export const createReviewService = async (
  userId: number,
  companyId: number,
  data: CreateReviewData,
) => {
  await ensureCompanyExists(companyId);

  const employment = await prisma.jobApplication.findFirst({
    where: {
      userId,
      job: {
        companyId,
      },
      status: "ACCEPTED",
    },
    orderBy: { updatedAt: "desc" },
    select: {
      job: {
        select: {
          title: true,
        },
      },
    },
  });

  if (!employment) {
    throw new ApiError(
      "You can only review a company if you are a verified employee",
      403,
    );
  }

  const existingReview = await prisma.companyReview.findFirst({
    where: {
      userId,
      companyId,
    },
    select: { id: true },
  });

  if (existingReview) {
    throw new ApiError("You have already reviewed this company", 409);
  }

  const ratings = [
    data.ratingCulture,
    data.ratingWorkLife,
    data.ratingFacility,
    data.ratingCareer,
  ];

  if (ratings.some((rating) => rating < 1 || rating > 5)) {
    throw new ApiError("Ratings must be between 1 and 5", 400);
  }

  return prisma.companyReview.create({
    data: {
      userId,
      companyId,
      jobTitleHeld: employment.job.title,
      salaryEstimate: data.salaryEstimate,
      ratingCulture: data.ratingCulture,
      ratingWorkLife: data.ratingWorkLife,
      ratingFacility: data.ratingFacility,
      ratingCareer: data.ratingCareer,
      reviewText: data.reviewText,
    },
    select: publicReviewSelect,
  });
};
