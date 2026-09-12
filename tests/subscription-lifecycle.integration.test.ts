import { afterAll, afterEach, beforeEach, describe, expect, it } from "vitest";

import { prisma } from "../lib/prisma.js";
import { expireSubscriptionsService } from "../services/subscription.service.js";
import { getSubscriptionStatus } from "../services/auth.service.js";

let testUserIds: number[] = [];
let testSubscriptionIds: number[] = [];

const createJobSeeker = async () => {
  const user = await prisma.user.create({
    data: {
      name: "Subscription Lifecycle User",
      email: `subscription-lifecycle-${Date.now()}-${Math.random()}@test.com`,
      password: "test-password",
      role: "JOB_SEEKER",
    },
  });

  testUserIds.push(user.id);

  return user;
};

const getStandardPlan = async () => {
  return prisma.subscription.upsert({
    where: {
      name: "STANDARD",
    },
    update: {
      price: 25000,
      durationDays: 30,
      featuresAccess: {
        cvGenerator: true,
        skillAssessmentLimit: 2,
      },
    },
    create: {
      name: "STANDARD",
      price: 25000,
      durationDays: 30,
      featuresAccess: {
        cvGenerator: true,
        skillAssessmentLimit: 2,
      },
    },
  });
};

const createUserSubscription = async ({
  status,
  startDate,
  endDate,
}: {
  status: "PENDING_APPROVAL" | "ACTIVE" | "EXPIRED";
  startDate?: Date | null;
  endDate?: Date | null;
}) => {
  const user = await createJobSeeker();
  const plan = await getStandardPlan();

  const userSubscription = await prisma.userSubscription.create({
    data: {
      userId: user.id,
      subscriptionId: plan.id,
      status,
      startDate: startDate ?? null,
      endDate: endDate ?? null,
    },
  });

  testSubscriptionIds.push(userSubscription.id);

  return {
    user,
    plan,
    userSubscription,
  };
};

describe("Subscription lifecycle", () => {
  beforeEach(async () => {
    await getStandardPlan();
  });

  afterEach(async () => {
    if (testSubscriptionIds.length > 0) {
      await prisma.userSubscription.deleteMany({
        where: {
          id: {
            in: testSubscriptionIds,
          },
        },
      });

      testSubscriptionIds = [];
    }

    if (testUserIds.length > 0) {
      await prisma.user.deleteMany({
        where: {
          id: {
            in: testUserIds,
          },
        },
      });

      testUserIds = [];
    }
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it("expires an active subscription when its end date has passed", async () => {
    const { userSubscription } = await createUserSubscription({
      status: "ACTIVE",
      startDate: new Date(Date.now() - 31 * 24 * 60 * 60 * 1000),
      endDate: new Date(Date.now() - 60 * 1000),
    });

    const result = await expireSubscriptionsService();

    expect(result.expired).toBe(1);

    const savedSubscription = await prisma.userSubscription.findUnique({
      where: {
        id: userSubscription.id,
      },
    });

    expect(savedSubscription?.status).toBe("EXPIRED");
  });

  it("keeps an active subscription active when its end date is still in the future", async () => {
    const { userSubscription } = await createUserSubscription({
      status: "ACTIVE",
      startDate: new Date(),
      endDate: new Date(Date.now() + 24 * 60 * 60 * 1000),
    });

    const result = await expireSubscriptionsService();

    expect(result.expired).toBe(0);

    const savedSubscription = await prisma.userSubscription.findUnique({
      where: {
        id: userSubscription.id,
      },
    });

    expect(savedSubscription?.status).toBe("ACTIVE");
  });

  it("does not change a pending subscription even when the end date has passed", async () => {
    const { userSubscription } = await createUserSubscription({
      status: "PENDING_APPROVAL",
      endDate: new Date(Date.now() - 60 * 1000),
    });

    const result = await expireSubscriptionsService();

    expect(result.expired).toBe(0);

    const savedSubscription = await prisma.userSubscription.findUnique({
      where: {
        id: userSubscription.id,
      },
    });

    expect(savedSubscription?.status).toBe("PENDING_APPROVAL");
  });

  it("leaves an already expired subscription unchanged", async () => {
    const { userSubscription } = await createUserSubscription({
      status: "EXPIRED",
      startDate: new Date(Date.now() - 40 * 24 * 60 * 60 * 1000),
      endDate: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000),
    });

    const result = await expireSubscriptionsService();

    expect(result.expired).toBe(0);

    const savedSubscription = await prisma.userSubscription.findUnique({
      where: {
        id: userSubscription.id,
      },
    });

    expect(savedSubscription?.status).toBe("EXPIRED");
  });

  it("expires multiple active subscriptions in one run", async () => {
    const first = await createUserSubscription({
      status: "ACTIVE",
      startDate: new Date(Date.now() - 31 * 24 * 60 * 60 * 1000),
      endDate: new Date(Date.now() - 5 * 60 * 1000),
    });

    const second = await createUserSubscription({
      status: "ACTIVE",
      startDate: new Date(Date.now() - 31 * 24 * 60 * 60 * 1000),
      endDate: new Date(Date.now() - 10 * 60 * 1000),
    });

    const result = await expireSubscriptionsService();

    expect(result.expired).toBe(2);

    const subscriptions = await prisma.userSubscription.findMany({
      where: {
        id: {
          in: [first.userSubscription.id, second.userSubscription.id],
        },
      },
    });

    expect(
      subscriptions.every((subscription) => subscription.status === "EXPIRED"),
    ).toBe(true);
  });

  it("reports subscription status as inactive after the subscription has ended", async () => {
    const { user } = await createUserSubscription({
      status: "ACTIVE",
      startDate: new Date(Date.now() - 31 * 24 * 60 * 60 * 1000),
      endDate: new Date(Date.now() - 60 * 1000),
    });

    const statusBeforeExpiryJob = await getSubscriptionStatus(user.id);

    expect(statusBeforeExpiryJob.active).toBe(false);

    await expireSubscriptionsService();

    const statusAfterExpiryJob = await getSubscriptionStatus(user.id);

    expect(statusAfterExpiryJob.active).toBe(false);
  });
});
