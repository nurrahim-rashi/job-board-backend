import { describe, it, expect, afterEach, afterAll } from "vitest";
import request from "supertest";
import jwt from "jsonwebtoken";

import app from "../app.js";
import { prisma } from "../lib/prisma.js";

const createTestJobSeeker = async (prefix = "jobseeker") => {
  return prisma.user.create({
    data: {
      name: "Test Job Seeker",
      email: `${prefix}-${Date.now()}@test.com`,
      password: "test-password",
      role: "JOB_SEEKER",
    },
  });
};

const createTestCompany = async (prefix = "company") => {
  const companyAdmin = await prisma.user.create({
    data: {
      name: "Test Company Admin",
      email: `${prefix}-${Date.now()}@test.com`,
      password: "test-password",
      role: "COMPANY_ADMIN",
    },
  });

  const company = await prisma.company.create({
    data: {
      userId: companyAdmin.id,
      companyName: "Test Company",
      phone: "081234567890",
      profileContent: "Company created for integration testing",
      city: "Jakarta",
    },
  });

  return { companyAdmin, company };
};

const createAcceptedApplication = async (userId: number, companyId: number) => {
  const job = await prisma.jobPosting.create({
    data: {
      companyId,
      title: "Backend Developer",
      slug: `backend-developer-test-${Date.now()}`,
      description: "Backend developer test job",
      category: "TECHNOLOGY",
      cityLocation: "Jakarta",
      deadline: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      isPublished: true,
    },
  });

  const application = await prisma.jobApplication.create({
    data: {
      userId,
      jobId: job.id,
      cvFile: "test-cv.pdf",
      status: "ACCEPTED",
    },
  });

  return { job, application };
};

const createToken = (user: { id: number; role: string }) => {
  return jwt.sign(
    {
      id: user.id,
      role: user.role,
    },
    process.env.JWT_SECRET!,
  );
};

const validReviewData = {
  jobTitleHeld: "Backend Developer",
  salaryEstimate: 12000000,
  ratingCulture: 4,
  ratingWorkLife: 4,
  ratingFacility: 3,
  ratingCareer: 5,
  reviewText: "Good company to work for.",
};

describe("POST /reviews/:companyId", () => {
  afterEach(async () => {
    await prisma.companyReview.deleteMany();
    await prisma.jobApplication.deleteMany();
    await prisma.jobPosting.deleteMany();
    await prisma.company.deleteMany();
    await prisma.user.deleteMany();
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it("should create a company review for a verified employee", async () => {
    const jobSeeker = await createTestJobSeeker();
    const { company } = await createTestCompany();

    await createAcceptedApplication(jobSeeker.id, company.id);

    const token = createToken(jobSeeker);

    const response = await request(app)
      .post(`/reviews/${company.id}`)
      .set("Authorization", `Bearer ${token}`)
      .send(validReviewData);

    expect(response.status).toBe(201);
    expect(response.body.message).toBe("Company review created successfully");

    expect(response.body.data).toMatchObject({
      userId: jobSeeker.id,
      companyId: company.id,
      jobTitleHeld: validReviewData.jobTitleHeld,
      salaryEstimate: 12000000,
      ratingCulture: validReviewData.ratingCulture,
      ratingWorkLife: validReviewData.ratingWorkLife,
      ratingFacility: validReviewData.ratingFacility,
      ratingCareer: validReviewData.ratingCareer,
      reviewText: validReviewData.reviewText,
    });

    const savedReview = await prisma.companyReview.findFirst({
      where: {
        userId: jobSeeker.id,
        companyId: company.id,
      },
    });

    expect(savedReview).not.toBeNull();

    expect(savedReview).toMatchObject({
      userId: jobSeeker.id,
      companyId: company.id,
      jobTitleHeld: validReviewData.jobTitleHeld,
      ratingCulture: validReviewData.ratingCulture,
      ratingWorkLife: validReviewData.ratingWorkLife,
      ratingFacility: validReviewData.ratingFacility,
      ratingCareer: validReviewData.ratingCareer,
      reviewText: validReviewData.reviewText,
    });
  });

  it("should reject review if user is not a verified employee", async () => {
    const jobSeeker = await createTestJobSeeker("unverified");
    const { company } = await createTestCompany("unverified-company");

    const token = createToken(jobSeeker);

    const response = await request(app)
      .post(`/reviews/${company.id}`)
      .set("Authorization", `Bearer ${token}`)
      .send(validReviewData);

    expect(response.status).toBe(403);
  });

  it("should reject duplicate review for the same company", async () => {
    const jobSeeker = await createTestJobSeeker("duplicate");
    const { company } = await createTestCompany("duplicate-company");

    await createAcceptedApplication(jobSeeker.id, company.id);

    const token = createToken(jobSeeker);

    const firstResponse = await request(app)
      .post(`/reviews/${company.id}`)
      .set("Authorization", `Bearer ${token}`)
      .send(validReviewData);

    expect(firstResponse.status).toBe(201);

    const secondResponse = await request(app)
      .post(`/reviews/${company.id}`)
      .set("Authorization", `Bearer ${token}`)
      .send(validReviewData);

    expect(secondResponse.status).toBe(409);
  });

  it("should reject review if rating is invalid", async () => {
    const jobSeeker = await createTestJobSeeker("invalid-rating");
    const token = createToken(jobSeeker);

    const response = await request(app)
      .post("/reviews/1")
      .set("Authorization", `Bearer ${token}`)
      .send({
        ...validReviewData,
        ratingCulture: 6,
      });

    expect(response.status).toBe(400);
  });

  it("should reject review if token is missing", async () => {
    const response = await request(app)
      .post("/reviews/1")
      .send(validReviewData);

    expect(response.status).toBe(401);
  });

  it("should return 404 if company does not exist", async () => {
    const jobSeeker = await createTestJobSeeker("missing-company");
    const token = createToken(jobSeeker);

    const response = await request(app)
      .post("/reviews/999999")
      .set("Authorization", `Bearer ${token}`)
      .send(validReviewData);

    expect(response.status).toBe(404);
  });
});
