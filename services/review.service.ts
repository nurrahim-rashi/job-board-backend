import { prisma } from "../lib/prisma.js";
import { ApiError } from "../utils/api-error.js";

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
