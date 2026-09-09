import { describe, it, expect, afterEach, afterAll } from "vitest";
import request from "supertest";
import jwt from "jsonwebtoken";
import type { Response } from "supertest";
import app from "../app.js";
import { prisma } from "../lib/prisma.js";

let testUserId: number | undefined;

const createJobSeeker = async () => {
  return prisma.user.create({
    data: {
      name: "CV Test User",
      email: `cv-user-${Date.now()}-${Math.random()}@test.com`,
      password: "test-password",
      role: "JOB_SEEKER",
      city: "Jakarta",
      province: "DKI Jakarta",
      lastEducation: "Bachelor's Degree",
    },
  });
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

const createActiveSubscription = async (userId: number) => {
  const subscription = await prisma.subscription.upsert({
    where: {
      name: "STANDARD",
    },
    update: {},
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

  return prisma.userSubscription.create({
    data: {
      userId,
      subscriptionId: subscription.id,
      status: "ACTIVE",
      startDate: new Date(),
      endDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
    },
  });
};

const binaryParser = (
  res: Response,
  callback: (error: Error | null, body: Buffer) => void,
) => {
  const chunks: Buffer[] = [];

  res.on("data", (chunk: Buffer) => {
    chunks.push(Buffer.from(chunk));
  });

  res.on("end", () => {
    callback(null, Buffer.concat(chunks));
  });

  res.on("error", (error: Error) => {
    callback(error, Buffer.alloc(0));
  });
};

const validCvInput = {
  professionalSummary:
    "Full-stack developer experienced in building web applications.",
  phone: "+62 81234567890",
  skills: ["TypeScript", "React", "Express", "PostgreSQL"],
  workExperiences: [
    {
      jobTitle: "Software Developer",
      company: "Example Company",
      startDate: "2025-01",
      endDate: "",
      isCurrent: true,
      description: "Developed and maintained web applications.",
    },
  ],
  educations: [
    {
      institution: "Example University",
      degree: "Bachelor's Degree",
      fieldOfStudy: "Computer Science",
      startYear: 2020,
      endYear: 2024,
    },
  ],
  projects: [
    {
      name: "Job Board Platform",
      description: "Developed a full-stack job board application.",
      technologies: ["React", "Express", "PostgreSQL"],
    },
  ],
  languages: [
    {
      language: "English",
      proficiency: "Professional",
    },
  ],
};

describe("POST /cv/generate", () => {
  afterEach(async () => {
    if (testUserId !== undefined) {
      await prisma.userSubscription.deleteMany({
        where: {
          userId: testUserId,
        },
      });

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

  it("should generate a PDF CV for a subscribed user", async () => {
    const user = await createJobSeeker();
    testUserId = user.id;

    await createActiveSubscription(user.id);

    const token = createToken(user);

    const response = await request(app)
      .post("/cv/generate")
      .set("Authorization", `Bearer ${token}`)
      .send(validCvInput)
      .buffer(true)
      .parse(binaryParser);

    expect(response.status).toBe(200);
    expect(response.headers["content-type"]).toContain("application/pdf");
    expect(response.headers["content-disposition"]).toContain("attachment");
    expect(Buffer.isBuffer(response.body)).toBe(true);
    expect(response.body.length).toBeGreaterThan(0);
    expect(response.body.subarray(0, 5).toString()).toBe("%PDF-");
  });

  it("should reject CV generation without authentication", async () => {
    const response = await request(app).post("/cv/generate").send(validCvInput);

    expect(response.status).toBe(401);
  });

  it("should reject CV generation without an active subscription", async () => {
    const user = await createJobSeeker();
    testUserId = user.id;

    const token = createToken(user);

    const response = await request(app)
      .post("/cv/generate")
      .set("Authorization", `Bearer ${token}`)
      .send(validCvInput);

    expect(response.status).toBe(403);
  });

  it("should reject CV generation when required fields are invalid", async () => {
    const user = await createJobSeeker();
    testUserId = user.id;

    await createActiveSubscription(user.id);

    const token = createToken(user);

    const response = await request(app)
      .post("/cv/generate")
      .set("Authorization", `Bearer ${token}`)
      .send({
        ...validCvInput,
        professionalSummary: "",
        skills: [],
        educations: [],
      });

    expect(response.status).toBe(400);
  });

  it("should allow CV generation without work experience", async () => {
    const user = await createJobSeeker();
    testUserId = user.id;

    await createActiveSubscription(user.id);

    const token = createToken(user);

    const response = await request(app)
      .post("/cv/generate")
      .set("Authorization", `Bearer ${token}`)
      .send({
        ...validCvInput,
        workExperiences: [],
      })
      .buffer(true)
      .parse(binaryParser);

    expect(response.status).toBe(200);
    expect(response.headers["content-type"]).toContain("application/pdf");
    expect(response.body.subarray(0, 5).toString()).toBe("%PDF-");
  });

  it("should require an end date for previous work experience", async () => {
    const user = await createJobSeeker();
    testUserId = user.id;

    await createActiveSubscription(user.id);

    const token = createToken(user);

    const response = await request(app)
      .post("/cv/generate")
      .set("Authorization", `Bearer ${token}`)
      .send({
        ...validCvInput,
        workExperiences: [
          {
            jobTitle: "Software Developer",
            company: "Example Company",
            startDate: "2024-01",
            isCurrent: false,
            description: "Developed web applications.",
          },
        ],
      });

    expect(response.status).toBe(400);
  });

  it("should reject CV generation without education", async () => {
    const user = await createJobSeeker();
    testUserId = user.id;

    await createActiveSubscription(user.id);

    const token = createToken(user);

    const response = await request(app)
      .post("/cv/generate")
      .set("Authorization", `Bearer ${token}`)
      .send({
        ...validCvInput,
        educations: [],
      });

    expect(response.status).toBe(400);
  });

  it("should reject CV generation without skills", async () => {
    const user = await createJobSeeker();
    testUserId = user.id;

    await createActiveSubscription(user.id);

    const token = createToken(user);

    const response = await request(app)
      .post("/cv/generate")
      .set("Authorization", `Bearer ${token}`)
      .send({
        ...validCvInput,
        skills: [],
      });

    expect(response.status).toBe(400);
  });
});
