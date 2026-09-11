import { prisma } from "../lib/prisma.js";
import { ApiError } from "../utils/api-error.js";
import { Prisma } from "../generated/prisma/client.js";
import { SubscriptionName, UserRole } from "../generated/prisma/enums.js";
import type { UpdateSubscriptionSchema } from "../validators/subscription.validator.js";

export const getSubscriptionPlansService = async () => {
  return prisma.subscription.findMany({
    select: {
      id: true,
      name: true,
      price: true,
      durationDays: true,
      featuresAccess: true,
    },
    orderBy: {
      price: "asc",
    },
  });
};

export const getDeveloperSubscriptionPlansService = async (
  userRole: UserRole,
) => {
  if (userRole !== "DEVELOPER") {
    throw new ApiError(
      "Only developer accounts can manage subscription plans",
      403,
    );
  }

  return prisma.subscription.findMany({
    orderBy: {
      price: "asc",
    },
  });
};

export const updateSubscriptionPlanService = async (
  userRole: UserRole,
  name: string,
  data: UpdateSubscriptionSchema,
) => {
  if (userRole !== "DEVELOPER") {
    throw new ApiError(
      "Only developer accounts can manage subscription plans",
      403,
    );
  }

  if (name !== "STANDARD" && name !== "PROFESSIONAL") {
    throw new ApiError("Invalid subscription plan", 400);
  }

  const subscription = await prisma.subscription.findUnique({
    where: {
      name,
    },
  });

  if (!subscription) {
    throw new ApiError("Subscription plan not found", 404);
  }

  return prisma.subscription.update({
    where: {
      name,
    },
    data: {
      ...(data.price !== undefined && {
        price: data.price,
      }),
      ...(data.durationDays !== undefined && {
        durationDays: data.durationDays,
      }),
      ...(data.featuresAccess !== undefined && {
        featuresAccess: data.featuresAccess as Prisma.InputJsonValue,
      }),
    },
  });
};
