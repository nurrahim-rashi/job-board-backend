import { prisma } from "../lib/prisma.js";
import { ApiError } from "../utils/api-error.js";
import { Prisma } from "../generated/prisma/client.js";
import { SubscriptionName, UserRole } from "../generated/prisma/enums.js";
import type { UpdateSubscriptionSchema } from "../validators/subscription.validator.js";
import { randomUUID } from "crypto";
import { midtransSnap } from "../lib/midtrans.js";
import type { PurchaseSubscriptionSchema } from "../validators/subscription-purchase.validator.js";
import type { MidtransNotificationResponse } from "../types/midtrans.js";

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

export const purchaseSubscriptionService = async (
  userId: number,
  userRole: UserRole,
  data: PurchaseSubscriptionSchema,
) => {
  if (userRole !== "JOB_SEEKER") {
    throw new ApiError("Only job seekers can purchase subscription plans", 403);
  }

  const subscription = await prisma.subscription.findUnique({
    where: {
      name: data.plan,
    },
  });

  if (!subscription) {
    throw new ApiError("Subscription plan not found", 404);
  }

  const existingPendingSubscription = await prisma.userSubscription.findFirst({
    where: {
      userId,
      status: "PENDING_APPROVAL",
      paymentStatus: "pending",
    },
  });

  if (existingPendingSubscription) {
    throw new ApiError("You already have a pending subscription payment", 409);
  }

  const existingActiveSubscription = await prisma.userSubscription.findFirst({
    where: {
      userId,
      status: "ACTIVE",
      endDate: {
        gte: new Date(),
      },
    },
  });

  if (existingActiveSubscription) {
    throw new ApiError("You already have an active subscription", 409);
  }

  const orderId = `SUB-${userId}-${Date.now()}-${randomUUID().slice(0, 8)}`;

  const midtransParameter = {
    transaction_details: {
      order_id: orderId,
      gross_amount: subscription.price,
    },
    item_details: [
      {
        id: String(subscription.id),
        price: subscription.price,
        quantity: 1,
        name: `${subscription.name} Subscription`,
      },
    ],
  };

  const transaction = await midtransSnap.createTransaction(
    midtransParameter as any,
  );

  const userSubscription = await prisma.userSubscription.create({
    data: {
      userId,
      subscriptionId: subscription.id,
      status: "PENDING_APPROVAL",
      midtransOrderId: orderId,
      midtransSnapToken: transaction.token,
      midtransRedirectUrl: transaction.redirect_url,
      paymentStatus: "pending",
    },
    include: {
      subscription: true,
    },
  });

  return {
    subscription: userSubscription,
    payment: {
      orderId,
      snapToken: transaction.token,
      redirectUrl: transaction.redirect_url,
    },
  };
};

export const handleMidtransNotificationService = async (
  notificationBody: unknown,
) => {
  const statusResponse = (await (midtransSnap as any).transaction.notification(
    notificationBody,
  )) as MidtransNotificationResponse;

  const orderId = statusResponse.order_id;
  const transactionStatus = statusResponse.transaction_status;
  const fraudStatus = statusResponse.fraud_status;

  const userSubscription = await prisma.userSubscription.findUnique({
    where: {
      midtransOrderId: orderId,
    },
    include: {
      subscription: true,
    },
  });

  if (!userSubscription) {
    throw new ApiError("Subscription transaction not found", 404);
  }

  const isSuccessfulPayment =
    transactionStatus === "settlement" ||
    (transactionStatus === "capture" && fraudStatus === "accept");

  if (isSuccessfulPayment) {
    // Midtrans may retry the same webhook.
    // Do not reset the subscription period if it is already active.
    if (userSubscription.status === "ACTIVE") {
      return userSubscription;
    }

    const startDate = new Date();
    const endDate = new Date(startDate);

    endDate.setDate(
      endDate.getDate() + userSubscription.subscription.durationDays,
    );

    return prisma.userSubscription.update({
      where: {
        id: userSubscription.id,
      },
      data: {
        status: "ACTIVE",
        paymentStatus: transactionStatus,
        startDate,
        endDate,
      },
      include: {
        subscription: true,
      },
    });
  }

  if (
    transactionStatus === "deny" ||
    transactionStatus === "cancel" ||
    transactionStatus === "expire"
  ) {
    return prisma.userSubscription.update({
      where: {
        id: userSubscription.id,
      },
      data: {
        paymentStatus: transactionStatus,
      },
      include: {
        subscription: true,
      },
    });
  }

  return prisma.userSubscription.update({
    where: {
      id: userSubscription.id,
    },
    data: {
      paymentStatus: transactionStatus,
    },
    include: {
      subscription: true,
    },
  });
};

export const expireSubscriptionsService = async () => {
  const now = new Date();

  const result = await prisma.userSubscription.updateMany({
    where: {
      status: "ACTIVE",
      endDate: {
        lte: now,
      },
    },
    data: {
      status: "EXPIRED",
    },
  });

  return {
    expired: result.count,
  };
};
