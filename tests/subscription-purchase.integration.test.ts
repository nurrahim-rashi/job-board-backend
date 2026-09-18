import {
  afterAll,
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";
import request from "supertest";
import jwt from "jsonwebtoken";

const { createTransactionMock } = vi.hoisted(() => ({
  createTransactionMock: vi.fn(),
}));

vi.mock("../lib/midtrans.js", () => ({
  midtransSnap: {
    createTransaction: createTransactionMock,
  },
}));

import app from "../app.js";
import { prisma } from "../lib/prisma.js";

let testUserIds: number[] = [];

const createToken = (user: { id: number; role: string }) => {
  return jwt.sign(
    {
      id: user.id,
      role: user.role,
    },
    process.env.JWT_SECRET!,
  );
};

const createJobSeeker = async () => {
  const user = await prisma.user.create({
    data: {
      name: "Subscription Job Seeker",
      email: `subscription-purchase-${Date.now()}-${Math.random()}@test.com`,
      password: "test-password",
      role: "JOB_SEEKER",
      emailVerifiedAt: new Date(),
    },
  });

  testUserIds.push(user.id);

  return user;
};

const createDeveloper = async () => {
  const user = await prisma.user.create({
    data: {
      name: "Subscription Developer",
      email: `subscription-purchase-dev-${Date.now()}-${Math.random()}@test.com`,
      password: "test-password",
      role: "DEVELOPER",
    },
  });

  testUserIds.push(user.id);

  return user;
};

const seedPlans = async () => {
  const standard = await prisma.subscription.upsert({
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

  const professional = await prisma.subscription.upsert({
    where: {
      name: "PROFESSIONAL",
    },
    update: {
      price: 100000,
      durationDays: 30,
      featuresAccess: {
        cvGenerator: true,
        skillAssessmentLimit: null,
        priorityReview: true,
      },
    },
    create: {
      name: "PROFESSIONAL",
      price: 100000,
      durationDays: 30,
      featuresAccess: {
        cvGenerator: true,
        skillAssessmentLimit: null,
        priorityReview: true,
      },
    },
  });

  return {
    standard,
    professional,
  };
};

describe("POST /subscriptions/purchase", () => {
  beforeEach(async () => {
    await seedPlans();

    createTransactionMock.mockReset();

    createTransactionMock.mockResolvedValue({
      token: "test-snap-token",
      redirect_url: "https://app.sandbox.midtrans.com/snap/test",
    });
  });

  afterEach(async () => {
    if (testUserIds.length > 0) {
      await prisma.userSubscription.deleteMany({
        where: {
          userId: {
            in: testUserIds,
          },
        },
      });

      await prisma.user.deleteMany({
        where: {
          id: {
            in: testUserIds,
          },
        },
      });
    }

    testUserIds = [];

    await seedPlans();
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it("Should allow job seeker to purchase STANDARD subscription", async () => {
    const user = await createJobSeeker();
    const token = createToken(user);

    const response = await request(app)
      .post("/subscriptions/purchase")
      .set("Authorization", `Bearer ${token}`)
      .send({
        plan: "STANDARD",
      });

    expect(response.status).toBe(201);

    expect(response.body.data.subscription).toMatchObject({
      userId: user.id,
      subscriptionId: expect.any(Number),
      status: "PENDING_APPROVAL",
      paymentStatus: "pending",
    });

    expect(response.body.data.payment).toMatchObject({
      orderId: expect.any(String),
      snapToken: "test-snap-token",
      redirectUrl: "https://app.sandbox.midtrans.com/snap/test",
    });

    const savedSubscription = await prisma.userSubscription.findFirst({
      where: {
        userId: user.id,
      },
    });

    expect(savedSubscription).not.toBeNull();
    expect(savedSubscription?.status).toBe("PENDING_APPROVAL");
    expect(savedSubscription?.paymentStatus).toBe("pending");
    expect(savedSubscription?.midtransSnapToken).toBe("test-snap-token");
  });

  it("Should allow job seeker to purchase PROFESSIONAL subscription", async () => {
    const user = await createJobSeeker();
    const token = createToken(user);

    const response = await request(app)
      .post("/subscriptions/purchase")
      .set("Authorization", `Bearer ${token}`)
      .send({
        plan: "PROFESSIONAL",
      });

    expect(response.status).toBe(201);

    expect(response.body.data.subscription.subscription).toMatchObject({
      name: "PROFESSIONAL",
      price: 100000,
    });
  });

  it("Should reject non-job-seeker subscription purchase", async () => {
    const developer = await createDeveloper();
    const token = createToken(developer);

    const response = await request(app)
      .post("/subscriptions/purchase")
      .set("Authorization", `Bearer ${token}`)
      .send({
        plan: "STANDARD",
      });

    expect(response.status).toBe(403);
    expect(createTransactionMock).not.toHaveBeenCalled();
  });

  it("Should reject invalid subscription plan", async () => {
    const user = await createJobSeeker();
    const token = createToken(user);

    const response = await request(app)
      .post("/subscriptions/purchase")
      .set("Authorization", `Bearer ${token}`)
      .send({
        plan: "BASIC",
      });

    expect(response.status).toBe(400);
    expect(createTransactionMock).not.toHaveBeenCalled();
  });

  it("Should reject user with pending subscription payment", async () => {
    const { standard } = await seedPlans();

    const user = await createJobSeeker();
    const token = createToken(user);

    await prisma.userSubscription.create({
      data: {
        userId: user.id,
        subscriptionId: standard.id,
        status: "PENDING_APPROVAL",
        paymentStatus: "pending",
      },
    });

    const response = await request(app)
      .post("/subscriptions/purchase")
      .set("Authorization", `Bearer ${token}`)
      .send({
        plan: "PROFESSIONAL",
      });

    expect(response.status).toBe(409);
    expect(createTransactionMock).not.toHaveBeenCalled();
  });

  it("Should reject user with active subscription", async () => {
    const { standard } = await seedPlans();

    const user = await createJobSeeker();
    const token = createToken(user);

    await prisma.userSubscription.create({
      data: {
        userId: user.id,
        subscriptionId: standard.id,
        status: "ACTIVE",
        startDate: new Date(),
        endDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      },
    });

    const response = await request(app)
      .post("/subscriptions/purchase")
      .set("Authorization", `Bearer ${token}`)
      .send({
        plan: "PROFESSIONAL",
      });

    expect(response.status).toBe(409);
    expect(createTransactionMock).not.toHaveBeenCalled();
  });

  it("Should use subscription price from database when creating Midtrans transaction", async () => {
    const user = await createJobSeeker();
    const token = createToken(user);

    const response = await request(app)
      .post("/subscriptions/purchase")
      .set("Authorization", `Bearer ${token}`)
      .send({
        plan: "STANDARD",

        // Deliberately malicious/irrelevant client value.
        price: 1,
      });

    expect(response.status).toBe(201);

    expect(createTransactionMock).toHaveBeenCalledTimes(1);

    expect(createTransactionMock).toHaveBeenCalledWith(
      expect.objectContaining({
        transaction_details: expect.objectContaining({
          gross_amount: 25000,
        }),
        item_details: [
          expect.objectContaining({
            price: 25000,
            quantity: 1,
            name: "STANDARD Subscription",
          }),
        ],
      }),
    );
  });
});
