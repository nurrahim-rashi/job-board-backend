import jwt from "jsonwebtoken";
import request from "supertest";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { notificationMock, createTransactionMock } = vi.hoisted(() => ({
  notificationMock: vi.fn(),
  createTransactionMock: vi.fn(),
}));

vi.mock("../lib/midtrans.js", () => ({
  midtransSnap: {
    createTransaction: createTransactionMock,
    transaction: {
      notification: notificationMock,
    },
  },
}));

const createTestToken = (user: { id: number; role: "JOB_SEEKER" }) => {
  return jwt.sign(
    {
      id: user.id,
      role: user.role,
    },
    process.env.JWT_SECRET!,
    {
      expiresIn: "7d",
    },
  );
};

import app from "../app.js";
import { prisma } from "../lib/prisma.js";

describe("Subscription payment notification", () => {
  const testUserIds: number[] = [];
  const testSubscriptionIds: number[] = [];

  const createJobSeeker = async () => {
    const unique = `${Date.now()}-${Math.random()}`;

    const user = await prisma.user.create({
      data: {
        name: "Payment Test User",
        email: `payment-${unique}@example.com`,
        password: "hashed-password",
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

  const createPendingSubscription = async (
    paymentStatus = "pending",
    orderId?: string,
  ) => {
    const user = await createJobSeeker();
    const plan = await getStandardPlan();

    const userSubscription = await prisma.userSubscription.create({
      data: {
        userId: user.id,
        subscriptionId: plan.id,
        status: "PENDING_APPROVAL",
        paymentStatus,
        midtransOrderId:
          orderId ??
          `SUB-TEST-${user.id}-${Date.now()}-${Math.random().toString(36).slice(2)}`,
      },
      include: {
        subscription: true,
      },
    });

    testSubscriptionIds.push(userSubscription.id);

    return {
      user,
      plan,
      userSubscription,
    };
  };

  beforeEach(() => {
    vi.clearAllMocks();
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

      testSubscriptionIds.length = 0;
    }

    if (testUserIds.length > 0) {
      await prisma.user.deleteMany({
        where: {
          id: {
            in: testUserIds,
          },
        },
      });

      testUserIds.length = 0;
    }
  });

  it("activates a subscription when Midtrans reports settlement", async () => {
    const { userSubscription, plan } = await createPendingSubscription();

    notificationMock.mockResolvedValue({
      order_id: userSubscription.midtransOrderId,
      transaction_status: "settlement",
    });

    const response = await request(app)
      .post("/subscriptions/payment-notification")
      .send({
        order_id: userSubscription.midtransOrderId,
        transaction_status: "settlement",
      });

    expect(response.status).toBe(200);
    expect(response.body.data.status).toBe("ACTIVE");
    expect(response.body.data.paymentStatus).toBe("settlement");
    expect(response.body.data.startDate).toBeTruthy();
    expect(response.body.data.endDate).toBeTruthy();

    expect(notificationMock).toHaveBeenCalledTimes(1);

    const savedSubscription = await prisma.userSubscription.findUnique({
      where: {
        id: userSubscription.id,
      },
    });

    expect(savedSubscription?.status).toBe("ACTIVE");
    expect(savedSubscription?.paymentStatus).toBe("settlement");
    expect(savedSubscription?.startDate).not.toBeNull();
    expect(savedSubscription?.endDate).not.toBeNull();

    const expectedDuration = plan.durationDays * 24 * 60 * 60 * 1000;

    const actualDuration =
      savedSubscription!.endDate!.getTime() -
      savedSubscription!.startDate!.getTime();

    expect(actualDuration).toBe(expectedDuration);
  });

  it("activates a subscription for capture when fraud status is accept", async () => {
    const { userSubscription } = await createPendingSubscription();

    notificationMock.mockResolvedValue({
      order_id: userSubscription.midtransOrderId,
      transaction_status: "capture",
      fraud_status: "accept",
    });

    const response = await request(app)
      .post("/subscriptions/payment-notification")
      .send({
        order_id: userSubscription.midtransOrderId,
        transaction_status: "capture",
        fraud_status: "accept",
      });

    expect(response.status).toBe(200);
    expect(response.body.data.status).toBe("ACTIVE");
    expect(response.body.data.paymentStatus).toBe("capture");

    const savedSubscription = await prisma.userSubscription.findUnique({
      where: {
        id: userSubscription.id,
      },
    });

    expect(savedSubscription?.status).toBe("ACTIVE");
    expect(savedSubscription?.startDate).not.toBeNull();
    expect(savedSubscription?.endDate).not.toBeNull();
  });

  it("does not activate capture when fraud status is not accept", async () => {
    const { userSubscription } = await createPendingSubscription();

    notificationMock.mockResolvedValue({
      order_id: userSubscription.midtransOrderId,
      transaction_status: "capture",
      fraud_status: "challenge",
    });

    const response = await request(app)
      .post("/subscriptions/payment-notification")
      .send({
        order_id: userSubscription.midtransOrderId,
        transaction_status: "capture",
        fraud_status: "challenge",
      });

    expect(response.status).toBe(200);

    const savedSubscription = await prisma.userSubscription.findUnique({
      where: {
        id: userSubscription.id,
      },
    });

    expect(savedSubscription?.status).toBe("PENDING_APPROVAL");
    expect(savedSubscription?.paymentStatus).toBe("capture");
    expect(savedSubscription?.startDate).toBeNull();
    expect(savedSubscription?.endDate).toBeNull();
  });

  it("does not reset subscription dates when a successful notification is received again", async () => {
    const { userSubscription } = await createPendingSubscription();

    const originalStartDate = new Date("2026-09-01T00:00:00.000Z");
    const originalEndDate = new Date("2026-10-01T00:00:00.000Z");

    await prisma.userSubscription.update({
      where: {
        id: userSubscription.id,
      },
      data: {
        status: "ACTIVE",
        paymentStatus: "settlement",
        startDate: originalStartDate,
        endDate: originalEndDate,
      },
    });

    notificationMock.mockResolvedValue({
      order_id: userSubscription.midtransOrderId,
      transaction_status: "settlement",
    });

    const response = await request(app)
      .post("/subscriptions/payment-notification")
      .send({
        order_id: userSubscription.midtransOrderId,
        transaction_status: "settlement",
      });

    expect(response.status).toBe(200);

    const savedSubscription = await prisma.userSubscription.findUnique({
      where: {
        id: userSubscription.id,
      },
    });

    expect(savedSubscription?.status).toBe("ACTIVE");
    expect(savedSubscription?.startDate?.toISOString()).toBe(
      originalStartDate.toISOString(),
    );
    expect(savedSubscription?.endDate?.toISOString()).toBe(
      originalEndDate.toISOString(),
    );
  });

  it("keeps the subscription pending when Midtrans reports pending", async () => {
    const { userSubscription } = await createPendingSubscription();

    notificationMock.mockResolvedValue({
      order_id: userSubscription.midtransOrderId,
      transaction_status: "pending",
    });

    const response = await request(app)
      .post("/subscriptions/payment-notification")
      .send({
        order_id: userSubscription.midtransOrderId,
        transaction_status: "pending",
      });

    expect(response.status).toBe(200);

    const savedSubscription = await prisma.userSubscription.findUnique({
      where: {
        id: userSubscription.id,
      },
    });

    expect(savedSubscription?.status).toBe("PENDING_APPROVAL");
    expect(savedSubscription?.paymentStatus).toBe("pending");
    expect(savedSubscription?.startDate).toBeNull();
    expect(savedSubscription?.endDate).toBeNull();
  });

  it.each(["deny", "cancel", "expire"])(
    "does not activate the subscription when Midtrans reports %s",
    async (transactionStatus) => {
      const { userSubscription } = await createPendingSubscription();

      notificationMock.mockResolvedValue({
        order_id: userSubscription.midtransOrderId,
        transaction_status: transactionStatus,
      });

      const response = await request(app)
        .post("/subscriptions/payment-notification")
        .send({
          order_id: userSubscription.midtransOrderId,
          transaction_status: transactionStatus,
        });

      expect(response.status).toBe(200);

      const savedSubscription = await prisma.userSubscription.findUnique({
        where: {
          id: userSubscription.id,
        },
      });

      expect(savedSubscription?.status).toBe("PENDING_APPROVAL");
      expect(savedSubscription?.paymentStatus).toBe(transactionStatus);
      expect(savedSubscription?.startDate).toBeNull();
      expect(savedSubscription?.endDate).toBeNull();
    },
  );

  it("returns 404 when the Midtrans order does not exist", async () => {
    notificationMock.mockResolvedValue({
      order_id: "SUB-DOES-NOT-EXIST",
      transaction_status: "settlement",
    });

    const response = await request(app)
      .post("/subscriptions/payment-notification")
      .send({
        order_id: "SUB-DOES-NOT-EXIST",
        transaction_status: "settlement",
      });

    expect(response.status).toBe(404);
  });

  it("allows a future purchase after a failed payment is no longer pending", async () => {
    const { user, userSubscription } =
      await createPendingSubscription("cancel");

    createTransactionMock.mockResolvedValue({
      token: "new-test-snap-token",
      redirect_url: "https://app.sandbox.midtrans.com/snap/test-new",
    });

    const token = createTestToken({
      id: user.id,
      role: "JOB_SEEKER",
    });

    const response = await request(app)
      .post("/subscriptions/purchase")
      .set("Authorization", `Bearer ${token}`)
      .send({
        plan: "STANDARD",
      });

    expect(response.status).toBe(201);
    expect(createTransactionMock).toHaveBeenCalledTimes(1);

    if (response.body.data?.subscription?.id) {
      testSubscriptionIds.push(response.body.data.subscription.id);
    }

    const oldSubscription = await prisma.userSubscription.findUnique({
      where: {
        id: userSubscription.id,
      },
    });

    expect(oldSubscription?.paymentStatus).toBe("cancel");
  });
});
