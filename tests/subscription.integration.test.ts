import { afterAll, afterEach, describe, expect, it } from "vitest";
import request from "supertest";
import jwt from "jsonwebtoken";
import app from "../app.js";
import { prisma } from "../lib/prisma.js";

const createToken = (user: { id: number; role: string }) => {
  return jwt.sign(
    {
      id: user.id,
      role: user.role,
    },
    process.env.JWT_SECRET!,
  );
};

const createDeveloper = async () => {
  return prisma.user.create({
    data: {
      name: "Subscription Developer",
      email: `subscription-dev-${Date.now()}-${Math.random()}@test.com`,
      password: "test-password",
      role: "DEVELOPER",
    },
  });
};

const createJobSeeker = async () => {
  return prisma.user.create({
    data: {
      name: "Subscription Job Seeker",
      email: `subscription-user-${Date.now()}-${Math.random()}@test.com`,
      password: "test-password",
      role: "JOB_SEEKER",
    },
  });
};

const seedPlans = async () => {
  await prisma.subscription.upsert({
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

  await prisma.subscription.upsert({
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
};

describe("Subscription category management", () => {
  afterEach(async () => {
    await prisma.userSubscription.deleteMany();

    await prisma.user.deleteMany({
      where: {
        email: {
          contains: "subscription-",
        },
      },
    });

    await seedPlans();
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it("Should return available subscription plans", async () => {
    await seedPlans();

    const response = await request(app).get("/subscriptions");

    expect(response.status).toBe(200);
    expect(response.body.data).toHaveLength(2);

    expect(response.body.data).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          name: "STANDARD",
          price: 25000,
          durationDays: 30,
        }),
        expect.objectContaining({
          name: "PROFESSIONAL",
          price: 100000,
          durationDays: 30,
        }),
      ]),
    );
  });

  it("Should allow developer to view subscription management data", async () => {
    await seedPlans();

    const developer = await createDeveloper();
    const token = createToken(developer);

    const response = await request(app)
      .get("/subscriptions/manage")
      .set("Authorization", `Bearer ${token}`);

    expect(response.status).toBe(200);
    expect(response.body.data).toHaveLength(2);
  });

  it("Should reject non-developer from subscription management", async () => {
    const jobSeeker = await createJobSeeker();
    const token = createToken(jobSeeker);

    const response = await request(app)
      .get("/subscriptions/manage")
      .set("Authorization", `Bearer ${token}`);

    expect(response.status).toBe(403);
  });

  it("Should allow developer to update subscription plan", async () => {
    await seedPlans();

    const developer = await createDeveloper();
    const token = createToken(developer);

    const response = await request(app)
      .patch("/subscriptions/STANDARD")
      .set("Authorization", `Bearer ${token}`)
      .send({
        price: 30000,
        durationDays: 45,
        featuresAccess: {
          cvGenerator: true,
          skillAssessmentLimit: 3,
        },
      });

    expect(response.status).toBe(200);

    expect(response.body.data).toMatchObject({
      name: "STANDARD",
      price: 30000,
      durationDays: 45,
    });

    const updatedPlan = await prisma.subscription.findUnique({
      where: {
        name: "STANDARD",
      },
    });

    expect(updatedPlan?.price).toBe(30000);
    expect(updatedPlan?.durationDays).toBe(45);
  });

  it("Should reject invalid subscription plan name", async () => {
    const developer = await createDeveloper();
    const token = createToken(developer);

    const response = await request(app)
      .patch("/subscriptions/BASIC")
      .set("Authorization", `Bearer ${token}`)
      .send({
        price: 20000,
      });

    expect(response.status).toBe(400);
  });

  it("Should reject invalid subscription update body", async () => {
    const developer = await createDeveloper();
    const token = createToken(developer);

    const response = await request(app)
      .patch("/subscriptions/STANDARD")
      .set("Authorization", `Bearer ${token}`)
      .send({
        price: -1,
        durationDays: 0,
      });

    expect(response.status).toBe(400);
  });

  it("Should reject empty subscription update", async () => {
    const developer = await createDeveloper();
    const token = createToken(developer);

    const response = await request(app)
      .patch("/subscriptions/STANDARD")
      .set("Authorization", `Bearer ${token}`)
      .send({});

    expect(response.status).toBe(400);
  });
});
