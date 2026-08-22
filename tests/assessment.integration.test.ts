import { describe, it, expect, afterEach, afterAll } from "vitest";
import request from "supertest";
import jwt from "jsonwebtoken";
import app from "../app.js";
import { prisma } from "../lib/prisma.js";

const createDeveloper = async () => {
  return prisma.user.create({
    data: {
      name: "Test developer",
      email: `developer-${Date.now()}@test.com`,
      password: "test-password",
      role: "DEVELOPER",
    },
  });
};

let testUserId: number | undefined;

const createToken = (user: { id: number; role: string }) => {
  return jwt.sign(
    {
      id: user.id,
      role: user.role,
    },
    process.env.JWT_SECRET!,
  );
};

describe("POST /assessment", () => {
  afterEach(async () => {
    await prisma.skillAssessmentQuestion.deleteMany();
    await prisma.skillAssessmentResult.deleteMany();
    await prisma.skillAssessment.deleteMany();

    if (testUserId) {
      await prisma.user.deleteMany({
        where: {
          id: testUserId,
        },
      });

      testUserId = undefined;
    }
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it("Should allow developer to create skill assessment", async () => {
    const developer = await createDeveloper();

    testUserId = developer.id;

    const token = createToken(developer);

    const response = await request(app)
      .post("/assessment")
      .set("Authorization", `Bearer ${token}`)
      .send({
        skillName: "TypeScript",
        title: "TypeScript Fundamentals",
        description: "Assessment for TypeScript fundamentals",
      });

    expect(response.status).toBe(201);

    expect(response.body.data).toMatchObject({
      skillName: "TypeScript",
      title: "TypeScript Fundamentals",
      description: "Assessment for TypeScript fundamentals",
      passingScore: 75,
      durationMinutes: 30,
      questionCount: 25,
    });

    const savedAssessment = await prisma.skillAssessment.findFirst({
      where: {
        skillName: "TypeScript",
      },
    });

    expect(savedAssessment).not.toBeNull();
    expect(savedAssessment?.passingScore).toBe(75);
    expect(savedAssessment?.durationMinutes).toBe(30);
    expect(savedAssessment?.questionCount).toBe(25);
  });

  it("Should reject non-developer from creating skill assessment", async () => {
    const jobSeeker = await prisma.user.create({
      data: {
        name: "Test Job Seeker",
        email: `jobseeker-${Date.now()}@test.com`,
        password: "test-password",
        role: "JOB_SEEKER",
      },
    });

    testUserId = jobSeeker.id;

    const token = createToken(jobSeeker);

    const response = await request(app)
      .post("/assessment")
      .set("Authorization", `Bearer ${token}`)
      .send({
        skillName: "Type Script",
        title: "TypeScript Fundamentals",
        description: "Assessment for TypeScript fundamentals",
      });

    expect(response.status).toBe(403);
  });

  it("Should reject assessment creation if required fields are missing", async () => {
    const developer = await createDeveloper();
    const token = createToken(developer);

    testUserId = developer.id;

    const response = await request(app)
      .post("/assessment")
      .set("Authorization", `Bearer ${token}`)
      .send({
        description: "Assessment with missing required fields",
      });

    expect(response.status).toBe(400);
  });

  it("Should not allow client to override assessment defaults", async () => {
    const developer = await createDeveloper();
    testUserId = developer.id;

    const token = createToken(developer);

    const response = await request(app)
      .post("/assessment")
      .set("Authorization", `Bearer ${token}`)
      .send({
        skillName: "TypeScript",
        title: "TypeScript Fundamentals",
        description: "Assessment for TypeScript fundamentals",

        passingScore: 10,
        durationMinutes: 5,
        questionCount: 3,
      });

    expect(response.status).toBe(201);

    expect(response.body.data).toMatchObject({
      skillName: "TypeScript",
      title: "TypeScript Fundamentals",
      passingScore: 75,
      durationMinutes: 30,
      questionCount: 25,
    });

    const savedAssessment = await prisma.skillAssessment.findFirst({
      where: {
        id: response.body.data.id,
      },
    });

    expect(savedAssessment).not.toBeNull();
    expect(savedAssessment?.passingScore).toBe(75);
    expect(savedAssessment?.durationMinutes).toBe(30);
    expect(savedAssessment?.questionCount).toBe(25);
  });

  it("Should reject duplicate assessment for the same skill", async () => {
    const developer = await createDeveloper();
    testUserId = developer.id;

    const token = createToken(developer);

    const assessmentData = {
      skillName: "TypeScript",
      title: "TypeScript Fundamentals",
      description: "Assessment for TypeScript fundamentals",
    };

    const firstResponse = await request(app)
      .post("/assessment")
      .set("Authorization", `Bearer ${token}`)
      .send(assessmentData);

    expect(firstResponse.status).toBe(201);

    const secondResponse = await request(app)
      .post("/assessment")
      .set("Authorization", `Bearer ${token}`)
      .send(assessmentData);

    expect(secondResponse.status).toBe(409);
  });
});
