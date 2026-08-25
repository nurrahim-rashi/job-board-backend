import { prisma } from "../lib/prisma.js";
import { ApiError } from "../utils/api-error.js";

export const checkActiveSubscription = async (userId: number) => {
  const activeSubscription = await prisma.userSubscription.findFirst({
    where: {
      userId,
      status: "ACTIVE",
      endDate: {
        gte: new Date(),
      },
    },
    include: {
      subscription: true,
    },
  });

  if (!activeSubscription) {
    throw new ApiError(
      "Active subscription is required to access skill assessments",
      403,
    );
  }

  return activeSubscription;
};
