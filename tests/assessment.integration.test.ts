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

const createTestAssessment = () => {
  return prisma.skillAssessment.create({
    data: {
      skillName: `TypeScript-${Date.now()}`,
      title: "TypeScript Fundamentals",
      description: "Test assessment",
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

  it("Should allow developer to create an assessment question", async () => {
    const developer = await createDeveloper();

    testUserId = developer.id;

    const assessment = await createTestAssessment();

    const token = createToken(developer);

    const questionData = {
      question: "Which keyword is used to declare a constant in JavaScript?",
      options: {
        A: "var",
        B: "let",
        C: "const",
        D: "static",
      },
      correctAnswer: "C",
      questionOrder: 1,
    };

    const response = await request(app)
      .post(`/assessment/${assessment.id}/questions`)
      .set("Authorization", `Bearer ${token}`)
      .send(questionData);

    expect(response.status).toBe(201);

    expect(response.body.data).toMatchObject({
      assessmentId: assessment.id,
      question: questionData.question,
      correctAnswer: "C",
      questionOrder: 1,
    });

    const savedQuestion = await prisma.skillAssessmentQuestion.findFirst({
      where: {
        assessmentId: assessment.id,
        questionOrder: 1,
      },
    });

    expect(savedQuestion).not.toBeNull();

    expect(savedQuestion).toMatchObject({
      assessmentId: assessment.id,
      question: questionData.question,
      correctAnswer: "C",
      questionOrder: 1,
    });
  });

  it("Should reject non-developer from creating an assessment question", async () => {
    const jobSeeker = await prisma.user.create({
      data: {
        name: "Test Job Seeker",
        email: `jobseeker-question-${Date.now()}@test.com`,
        password: "test-password",
        role: "JOB_SEEKER",
      },
    });

    testUserId = jobSeeker.id;

    const assessment = await createTestAssessment();

    const token = createToken(jobSeeker);

    const response = await request(app)
      .post(`/assessment/${assessment.id}/questions`)
      .set("Authorization", `Bearer ${token}`)
      .send({
        question: "Which keyword declares a constant?",
        options: {
          A: "var",
          B: "let",
          C: "const",
          D: "static",
        },
        correctAnswer: "C",
        questionOrder: 1,
      });

    expect(response.status).toBe(403);
  });

  it("Should return 404 if assessment does not exist", async () => {
    const developer = await createDeveloper();

    testUserId = developer.id;

    const token = createToken(developer);

    const response = await request(app)
      .post("/assessment/999999/questions")
      .set("Authorization", `Bearer ${token}`)
      .send({
        question: "Which keyword declares a constant?",
        options: {
          A: "var",
          B: "let",
          C: "const",
          D: "static",
        },
        correctAnswer: "C",
        questionOrder: 1,
      });

    expect(response.status).toBe(404);
  });

  it("Should reject duplicate question order in the same assessment", async () => {
    const developer = await createDeveloper();

    testUserId = developer.id;

    const assessment = await createTestAssessment();

    const token = createToken(developer);

    const firstQuestion = {
      question: "Which keyword declares a constant?",
      options: {
        A: "var",
        B: "let",
        C: "const",
        D: "static",
      },
      correctAnswer: "C",
      questionOrder: 1,
    };

    const secondQuestion = {
      question: "Which keyword declares a variable?",
      options: {
        A: "const",
        B: "let",
        C: "static",
        D: "final",
      },
      correctAnswer: "B",
      questionOrder: 1, // deliberately duplicated
    };

    const firstResponse = await request(app)
      .post(`/assessment/${assessment.id}/questions`)
      .set("Authorization", `Bearer ${token}`)
      .send(firstQuestion);

    expect(firstResponse.status).toBe(201);

    const secondResponse = await request(app)
      .post(`/assessment/${assessment.id}/questions`)
      .set("Authorization", `Bearer ${token}`)
      .send(secondQuestion);

    expect(secondResponse.status).toBe(409);
  });

  it("Should reject invalid assessment question data", async () => {
    const developer = await createDeveloper();

    testUserId = developer.id;

    const assessment = await createTestAssessment();

    const token = createToken(developer);

    const response = await request(app)
      .post(`/assessment/${assessment.id}/questions`)
      .set("Authorization", `Bearer ${token}`)
      .send({
        question: "",
        options: {
          A: "var",
          B: "let",
          C: "const",
          D: "static",
        },
        correctAnswer: "E",
        questionOrder: 0,
      });

    expect(response.status).toBe(400);
  });

  it("Should reject creating more than 25 questions", async () => {
    const developer = await createDeveloper();

    testUserId = developer.id;

    const assessment = await createTestAssessment();

    const token = createToken(developer);

    // Create the maximum 25 questions directly in the DB
    await prisma.skillAssessmentQuestion.createMany({
      data: Array.from({ length: 25 }, (_, index) => ({
        assessmentId: assessment.id,
        question: `Test question ${index + 1}`,
        options: {
          A: "Option A",
          B: "Option B",
          C: "Option C",
          D: "Option D",
        },
        correctAnswer: "A",
        questionOrder: index + 1,
      })),
    });

    // Try to create question #26 through the endpoint
    const response = await request(app)
      .post(`/assessment/${assessment.id}/questions`)
      .set("Authorization", `Bearer ${token}`)
      .send({
        question: "This should be question 26",
        options: {
          A: "Option A",
          B: "Option B",
          C: "Option C",
          D: "Option D",
        },
        correctAnswer: "A",
        questionOrder: 25,
      });

    expect(response.status).toBe(409);

    const questionCount = await prisma.skillAssessmentQuestion.count({
      where: {
        assessmentId: assessment.id,
      },
    });

    expect(questionCount).toBe(25);
  });
});
