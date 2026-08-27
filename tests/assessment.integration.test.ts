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
let additionalTestUserId: number | undefined;

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

const create25Questions = async (assessmentId: number) => {
  await prisma.skillAssessmentQuestion.createMany({
    data: Array.from({ length: 25 }, (_, index) => ({
      assessmentId,
      question: `Assessment question ${index + 1}`,
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
};

describe("POST /assessment", () => {
  afterEach(async () => {
    await prisma.skillAssessmentAnswer.deleteMany();
    await prisma.skillAssessmentQuestion.deleteMany();
    await prisma.skillAssessmentResult.deleteMany();
    await prisma.skillAssessment.deleteMany();

    const userIds = [testUserId, additionalTestUserId].filter(
      (id): id is number => id !== undefined,
    );

    if (userIds.length > 0) {
      await prisma.userSubscription.deleteMany({
        where: {
          userId: {
            in: userIds,
          },
        },
      });

      await prisma.user.deleteMany({
        where: {
          id: {
            in: userIds,
          },
        },
      });

      testUserId = undefined;
      additionalTestUserId = undefined;
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

  it("Should allow developer to get assessment questions", async () => {
    const developer = await createDeveloper();
    testUserId = developer.id;

    const assessment = await createTestAssessment();
    const token = createToken(developer);

    await prisma.skillAssessmentQuestion.createMany({
      data: [
        {
          assessmentId: assessment.id,
          question: "Question number two",
          options: {
            A: "A",
            B: "B",
            C: "C",
            D: "D",
          },
          correctAnswer: "B",
          questionOrder: 2,
        },
        {
          assessmentId: assessment.id,
          question: "Question number one",
          options: {
            A: "A",
            B: "B",
            C: "C",
            D: "D",
          },
          correctAnswer: "A",
          questionOrder: 1,
        },
      ],
    });

    const response = await request(app)
      .get(`/assessment/${assessment.id}/questions`)
      .set("Authorization", `Bearer ${token}`);

    expect(response.status).toBe(200);

    expect(response.body.message).toBe(
      "Assessment questions retrieved successfully",
    );

    expect(response.body.data).toHaveLength(2);

    expect(response.body.data[0]).toMatchObject({
      assessmentId: assessment.id,
      question: "Question number one",
      correctAnswer: "A",
      questionOrder: 1,
    });

    expect(response.body.data[1]).toMatchObject({
      assessmentId: assessment.id,
      question: "Question number two",
      correctAnswer: "B",
      questionOrder: 2,
    });
  });

  it("Should allow developer to update an assessment question", async () => {
    const developer = await createDeveloper();
    testUserId = developer.id;

    const assessment = await createTestAssessment();
    const token = createToken(developer);

    const question = await prisma.skillAssessmentQuestion.create({
      data: {
        assessmentId: assessment.id,
        question: "Old question",
        options: {
          A: "Old A",
          B: "Old B",
          C: "Old C",
          D: "Old D",
        },
        correctAnswer: "A",
        questionOrder: 1,
      },
    });

    const response = await request(app)
      .patch(`/assessment/${assessment.id}/questions/${question.id}`)
      .set("Authorization", `Bearer ${token}`)
      .send({
        question: "Updated question",
        options: {
          A: "Updated A",
          B: "Updated B",
          C: "Updated C",
          D: "Updated D",
        },
        correctAnswer: "C",
        questionOrder: 2,
      });

    expect(response.status).toBe(200);

    expect(response.body.message).toBe(
      "Assessment question updated successfully",
    );

    expect(response.body.data).toMatchObject({
      id: question.id,
      assessmentId: assessment.id,
      question: "Updated question",
      correctAnswer: "C",
      questionOrder: 2,
    });

    const updatedQuestion = await prisma.skillAssessmentQuestion.findUnique({
      where: {
        id: question.id,
      },
    });

    expect(updatedQuestion).not.toBeNull();

    expect(updatedQuestion).toMatchObject({
      question: "Updated question",
      correctAnswer: "C",
      questionOrder: 2,
    });
  });

  it("Should allow developer to delete an assessment question", async () => {
    const developer = await createDeveloper();
    testUserId = developer.id;

    const assessment = await createTestAssessment();
    const token = createToken(developer);

    const question = await prisma.skillAssessmentQuestion.create({
      data: {
        assessmentId: assessment.id,
        question: "Question to delete",
        options: {
          A: "A",
          B: "B",
          C: "C",
          D: "D",
        },
        correctAnswer: "A",
        questionOrder: 1,
      },
    });

    const response = await request(app)
      .delete(`/assessment/${assessment.id}/questions/${question.id}`)
      .set("Authorization", `Bearer ${token}`);

    console.log(response.status, response.body);

    expect(response.status).toBe(200);

    expect(response.body.message).toBe(
      "Assessment question deleted successfully",
    );

    const deletedQuestion = await prisma.skillAssessmentQuestion.findUnique({
      where: {
        id: question.id,
      },
    });

    expect(deletedQuestion).toBeNull();
  });

  it("Should return 404 when updating a nonexistent assessment question", async () => {
    const developer = await createDeveloper();
    testUserId = developer.id;

    const assessment = await createTestAssessment();
    const token = createToken(developer);

    const response = await request(app)
      .patch(`/assessment/${assessment.id}/questions/999999`)
      .set("Authorization", `Bearer ${token}`)
      .send({
        question: "Updated question",
      });

    expect(response.status).toBe(404);

    expect(response.body.message).toBe("Assessment question not found");
  });

  it("Should reject duplicate question order when updating a question", async () => {
    const developer = await createDeveloper();
    testUserId = developer.id;

    const assessment = await createTestAssessment();
    const token = createToken(developer);

    await prisma.skillAssessmentQuestion.create({
      data: {
        assessmentId: assessment.id,
        question: "First question",
        options: {
          A: "A",
          B: "B",
          C: "C",
          D: "D",
        },
        correctAnswer: "A",
        questionOrder: 1,
      },
    });

    const secondQuestion = await prisma.skillAssessmentQuestion.create({
      data: {
        assessmentId: assessment.id,
        question: "Second question",
        options: {
          A: "A",
          B: "B",
          C: "C",
          D: "D",
        },
        correctAnswer: "B",
        questionOrder: 2,
      },
    });

    const response = await request(app)
      .patch(`/assessment/${assessment.id}/questions/${secondQuestion.id}`)
      .set("Authorization", `Bearer ${token}`)
      .send({
        questionOrder: 1,
      });

    expect(response.status).toBe(409);

    expect(response.body.message).toBe(
      "Question order already exists for this assessment",
    );
  });

  it("Should reject invalid assessment question update data", async () => {
    const developer = await createDeveloper();
    testUserId = developer.id;

    const assessment = await createTestAssessment();
    const token = createToken(developer);

    const question = await prisma.skillAssessmentQuestion.create({
      data: {
        assessmentId: assessment.id,
        question: "Original question",
        options: {
          A: "A",
          B: "B",
          C: "C",
          D: "D",
        },
        correctAnswer: "A",
        questionOrder: 1,
      },
    });

    const response = await request(app)
      .patch(`/assessment/${assessment.id}/questions/${question.id}`)
      .set("Authorization", `Bearer ${token}`)
      .send({
        question: "",
        correctAnswer: "E",
        questionOrder: 0,
      });

    expect(response.status).toBe(400);
  });

  it("Should reject non-developer from managing assessment questions", async () => {
    const jobSeeker = await prisma.user.create({
      data: {
        name: "Test Job Seeker",
        email: `jobseeker-manage-${Date.now()}@test.com`,
        password: "test-password",
        role: "JOB_SEEKER",
      },
    });

    testUserId = jobSeeker.id;

    const assessment = await createTestAssessment();
    const token = createToken(jobSeeker);

    const response = await request(app)
      .get(`/assessment/${assessment.id}/questions`)
      .set("Authorization", `Bearer ${token}`);

    expect(response.status).toBe(403);

    expect(response.body.message).toBe(
      "Only developer accounts can manage assessment questions",
    );
  });

  it("Should allow active subscriber to discover assessments", async () => {
    const jobSeeker = await prisma.user.create({
      data: {
        name: "Subscribed Job Seeker",
        email: `subscriber-${Date.now()}@test.com`,
        password: "test-password",
        role: "JOB_SEEKER",
      },
    });

    testUserId = jobSeeker.id;

    await createActiveSubscription(jobSeeker.id);

    const assessment = await createTestAssessment();

    const token = createToken(jobSeeker);

    const response = await request(app)
      .get("/assessment/discovery")
      .set("Authorization", `Bearer ${token}`);

    expect(response.status).toBe(200);

    expect(response.body.message).toBe(
      "Available assessments retrieved successfully",
    );

    expect(response.body.data).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: assessment.id,
          skillName: assessment.skillName,
          title: assessment.title,
          passingScore: 75,
          durationMinutes: 30,
          questionCount: 25,
        }),
      ]),
    );
  });

  it("Should reject assessment discovery without active subscription", async () => {
    const jobSeeker = await prisma.user.create({
      data: {
        name: "Unsubscribed Job Seeker",
        email: `unsubscribed-${Date.now()}@test.com`,
        password: "test-password",
        role: "JOB_SEEKER",
      },
    });

    testUserId = jobSeeker.id;

    const token = createToken(jobSeeker);

    const response = await request(app)
      .get("/assessment/discovery")
      .set("Authorization", `Bearer ${token}`);

    expect(response.status).toBe(403);

    expect(response.body.message).toBe(
      "Active subscription is required to access skill assessments",
    );
  });

  it("Should allow active subscriber to view assessment detail", async () => {
    const jobSeeker = await prisma.user.create({
      data: {
        name: "Subscribed Job Seeker",
        email: `subscriber-detail-${Date.now()}@test.com`,
        password: "test-password",
        role: "JOB_SEEKER",
      },
    });

    testUserId = jobSeeker.id;

    await createActiveSubscription(jobSeeker.id);

    const assessment = await createTestAssessment();

    const token = createToken(jobSeeker);

    const response = await request(app)
      .get(`/assessment/discovery/${assessment.id}`)
      .set("Authorization", `Bearer ${token}`);

    expect(response.status).toBe(200);

    expect(response.body.message).toBe(
      "Assessment detail retrieved successfully",
    );

    expect(response.body.data).toMatchObject({
      id: assessment.id,
      skillName: assessment.skillName,
      title: assessment.title,
      passingScore: 75,
      durationMinutes: 30,
      questionCount: 25,
    });

    expect(response.body.data).not.toHaveProperty("questions");
  });

  it("Should return 404 if assessment detail does not exist", async () => {
    const jobSeeker = await prisma.user.create({
      data: {
        name: "Subscribed Job Seeker",
        email: `subscriber-missing-${Date.now()}@test.com`,
        password: "test-password",
        role: "JOB_SEEKER",
      },
    });

    testUserId = jobSeeker.id;

    await createActiveSubscription(jobSeeker.id);

    const token = createToken(jobSeeker);

    const response = await request(app)
      .get("/assessment/discovery/999999")
      .set("Authorization", `Bearer ${token}`);

    expect(response.status).toBe(404);

    expect(response.body.message).toBe("Assessment not found");
  });

  it("Should allow active subscriber to start an assessment", async () => {
    const jobSeeker = await prisma.user.create({
      data: {
        name: "Assessment Test User",
        email: `start-assessment-${Date.now()}@test.com`,
        password: "test-password",
        role: "JOB_SEEKER",
      },
    });

    testUserId = jobSeeker.id;

    await createActiveSubscription(jobSeeker.id);

    const assessment = await createTestAssessment();

    await create25Questions(assessment.id);

    const token = createToken(jobSeeker);

    const response = await request(app)
      .post(`/assessment/${assessment.id}/start`)
      .set("Authorization", `Bearer ${token}`);

    expect(response.status).toBe(201);

    expect(response.body.message).toBe("Assessment started successfully");

    expect(response.body.data.resultId).toBeDefined();
    expect(response.body.data.startedAt).toBeDefined();
    expect(response.body.data.expiresAt).toBeDefined();

    expect(response.body.data.assessment).toMatchObject({
      id: assessment.id,
      skillName: assessment.skillName,
      title: assessment.title,
      durationMinutes: 30,
      questionCount: 25,
    });

    expect(response.body.data.questions).toHaveLength(25);

    expect(response.body.data.questions[0]).toMatchObject({
      questionOrder: 1,
      question: "Assessment question 1",
    });

    // Security check: answers must NEVER be exposed.
    for (const question of response.body.data.questions) {
      expect(question).not.toHaveProperty("correctAnswer");
    }

    // Verify the attempt was persisted.
    const savedResult = await prisma.skillAssessmentResult.findUnique({
      where: {
        id: response.body.data.resultId,
      },
    });

    expect(savedResult).not.toBeNull();

    expect(savedResult).toMatchObject({
      userId: jobSeeker.id,
      assessmentId: assessment.id,
      score: 0,
      isPassed: false,
      completedAt: null,
    });
  });

  it("Should reject starting assessment without active subscription", async () => {
    const jobSeeker = await prisma.user.create({
      data: {
        name: "Unsubscribed Assessment User",
        email: `start-no-sub-${Date.now()}@test.com`,
        password: "test-password",
        role: "JOB_SEEKER",
      },
    });

    testUserId = jobSeeker.id;

    const assessment = await createTestAssessment();

    await create25Questions(assessment.id);

    const token = createToken(jobSeeker);

    const response = await request(app)
      .post(`/assessment/${assessment.id}/start`)
      .set("Authorization", `Bearer ${token}`);

    expect(response.status).toBe(403);

    expect(response.body.message).toBe(
      "Active subscription is required to access skill assessments",
    );
  });

  it("Should return 404 when starting a nonexistent assessment", async () => {
    const jobSeeker = await prisma.user.create({
      data: {
        name: "Subscribed Missing Assessment User",
        email: `start-missing-${Date.now()}@test.com`,
        password: "test-password",
        role: "JOB_SEEKER",
      },
    });

    testUserId = jobSeeker.id;

    await createActiveSubscription(jobSeeker.id);

    const token = createToken(jobSeeker);

    const response = await request(app)
      .post("/assessment/999999/start")
      .set("Authorization", `Bearer ${token}`);

    expect(response.status).toBe(404);

    expect(response.body.message).toBe("Assessment not found");
  });

  it("Should reject starting assessment with fewer than 25 questions", async () => {
    const jobSeeker = await prisma.user.create({
      data: {
        name: "Incomplete Assessment User",
        email: `incomplete-assessment-${Date.now()}@test.com`,
        password: "test-password",
        role: "JOB_SEEKER",
      },
    });

    testUserId = jobSeeker.id;

    await createActiveSubscription(jobSeeker.id);

    const assessment = await createTestAssessment();

    await prisma.skillAssessmentQuestion.createMany({
      data: Array.from({ length: 24 }, (_, index) => ({
        assessmentId: assessment.id,
        question: `Assessment question ${index + 1}`,
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

    const token = createToken(jobSeeker);

    const response = await request(app)
      .post(`/assessment/${assessment.id}/start`)
      .set("Authorization", `Bearer ${token}`);

    expect(response.status).toBe(409);

    expect(response.body.message).toBe(
      "Assessment must contain exactly 25 questions before it can be started",
    );
  });

  it("Should reject starting a new assessment while an active attempt exists", async () => {
    const jobSeeker = await prisma.user.create({
      data: {
        name: "Active Attempt User",
        email: `active-attempt-${Date.now()}@test.com`,
        password: "test-password",
        role: "JOB_SEEKER",
      },
    });

    testUserId = jobSeeker.id;

    await createActiveSubscription(jobSeeker.id);

    const assessment = await createTestAssessment();

    await create25Questions(assessment.id);

    const token = createToken(jobSeeker);

    const firstResponse = await request(app)
      .post(`/assessment/${assessment.id}/start`)
      .set("Authorization", `Bearer ${token}`);

    expect(firstResponse.status).toBe(201);

    const secondResponse = await request(app)
      .post(`/assessment/${assessment.id}/start`)
      .set("Authorization", `Bearer ${token}`);

    expect(secondResponse.status).toBe(409);

    expect(secondResponse.body.message).toBe(
      "You already have an active attempt for this assessment",
    );
  });

  it("Should submit assessment successfully and pass", async () => {
    const jobSeeker = await prisma.user.create({
      data: {
        name: "Passing Assessment User",
        email: `passing-assessment-${Date.now()}@test.com`,
        password: "test-password",
        role: "JOB_SEEKER",
      },
    });

    testUserId = jobSeeker.id;

    await createActiveSubscription(jobSeeker.id);

    const assessment = await createTestAssessment();

    await create25Questions(assessment.id);

    const token = createToken(jobSeeker);

    const startResponse = await request(app)
      .post(`/assessment/${assessment.id}/start`)
      .set("Authorization", `Bearer ${token}`);

    expect(startResponse.status).toBe(201);

    const resultId = startResponse.body.data.resultId;

    const questions = await prisma.skillAssessmentQuestion.findMany({
      where: {
        assessmentId: assessment.id,
      },
      orderBy: {
        questionOrder: "asc",
      },
    });

    const answers = questions.map((question) => ({
      questionId: question.id,
      answer: question.correctAnswer,
    }));

    const response = await request(app)
      .post(`/assessment/${assessment.id}/submit`)
      .set("Authorization", `Bearer ${token}`)
      .send({
        resultId,
        answers,
      });

    expect(response.status).toBe(200);

    expect(response.body.message).toBe("Assessment submitted successfully");

    expect(response.body.data).toMatchObject({
      resultId,
      score: 100,
      isPassed: true,
      correctAnswers: 25,
      totalQuestions: 25,
    });

    expect(response.body.data.badgeName).toBe(
      `${assessment.skillName} Skill Badge`,
    );

    const savedResult = await prisma.skillAssessmentResult.findUnique({
      where: {
        id: resultId,
      },
    });

    expect(savedResult).not.toBeNull();

    expect(savedResult).toMatchObject({
      score: 100,
      isPassed: true,
      badgeName: `${assessment.skillName} Skill Badge`,
    });

    expect(savedResult?.completedAt).not.toBeNull();

    const savedAnswers = await prisma.skillAssessmentAnswer.findMany({
      where: {
        resultId,
      },
    });

    expect(savedAnswers).toHaveLength(25);

    expect(savedAnswers.every((answer) => answer.isCorrect)).toBe(true);
  });

  it("Should submit assessment successfully and fail", async () => {
    const jobSeeker = await prisma.user.create({
      data: {
        name: "Failing Assessment User",
        email: `failing-assessment-${Date.now()}@test.com`,
        password: "test-password",
        role: "JOB_SEEKER",
      },
    });

    testUserId = jobSeeker.id;

    await createActiveSubscription(jobSeeker.id);

    const assessment = await createTestAssessment();

    await create25Questions(assessment.id);

    const token = createToken(jobSeeker);

    const startResponse = await request(app)
      .post(`/assessment/${assessment.id}/start`)
      .set("Authorization", `Bearer ${token}`);

    expect(startResponse.status).toBe(201);

    const resultId = startResponse.body.data.resultId;

    const questions = await prisma.skillAssessmentQuestion.findMany({
      where: {
        assessmentId: assessment.id,
      },
      orderBy: {
        questionOrder: "asc",
      },
    });

    const answers = questions.map((question, index) => ({
      questionId: question.id,

      // 18 correct, 7 wrong
      answer: index < 18 ? question.correctAnswer : "B",
    }));

    const response = await request(app)
      .post(`/assessment/${assessment.id}/submit`)
      .set("Authorization", `Bearer ${token}`)
      .send({
        resultId,
        answers,
      });

    expect(response.status).toBe(200);

    expect(response.body.data).toMatchObject({
      resultId,
      score: 72,
      isPassed: false,
      correctAnswers: 18,
      totalQuestions: 25,
      badgeName: null,
    });

    const savedResult = await prisma.skillAssessmentResult.findUnique({
      where: {
        id: resultId,
      },
    });

    expect(savedResult).toMatchObject({
      score: 72,
      isPassed: false,
      badgeName: null,
    });

    expect(savedResult?.completedAt).not.toBeNull();
  });

  it("Should reject submission if assessment time has expired", async () => {
    const jobSeeker = await prisma.user.create({
      data: {
        name: "Expired Assessment User",
        email: `expired-assessment-${Date.now()}@test.com`,
        password: "test-password",
        role: "JOB_SEEKER",
      },
    });

    testUserId = jobSeeker.id;

    await createActiveSubscription(jobSeeker.id);

    const assessment = await createTestAssessment();

    await create25Questions(assessment.id);

    const token = createToken(jobSeeker);

    const startResponse = await request(app)
      .post(`/assessment/${assessment.id}/start`)
      .set("Authorization", `Bearer ${token}`);

    expect(startResponse.status).toBe(201);

    const resultId = startResponse.body.data.resultId;

    await prisma.skillAssessmentResult.update({
      where: {
        id: resultId,
      },
      data: {
        startedAt: new Date(Date.now() - 31 * 60 * 1000),
      },
    });

    const questions = await prisma.skillAssessmentQuestion.findMany({
      where: {
        assessmentId: assessment.id,
      },
      orderBy: {
        questionOrder: "asc",
      },
    });

    const answers = questions.map((question) => ({
      questionId: question.id,
      answer: question.correctAnswer,
    }));

    const response = await request(app)
      .post(`/assessment/${assessment.id}/submit`)
      .set("Authorization", `Bearer ${token}`)
      .send({
        resultId,
        answers,
      });

    expect(response.status).toBe(409);

    expect(response.body.message).toBe("Assessment time has expired");
  });

  it("Should reject submitting an assessment that was already completed", async () => {
    const jobSeeker = await prisma.user.create({
      data: {
        name: "Completed Assessment User",
        email: `completed-assessment-${Date.now()}@test.com`,
        password: "test-password",
        role: "JOB_SEEKER",
      },
    });

    testUserId = jobSeeker.id;

    await createActiveSubscription(jobSeeker.id);

    const assessment = await createTestAssessment();

    await create25Questions(assessment.id);

    const token = createToken(jobSeeker);

    const startResponse = await request(app)
      .post(`/assessment/${assessment.id}/start`)
      .set("Authorization", `Bearer ${token}`);

    expect(startResponse.status).toBe(201);

    const resultId = startResponse.body.data.resultId;

    const questions = await prisma.skillAssessmentQuestion.findMany({
      where: {
        assessmentId: assessment.id,
      },
      orderBy: {
        questionOrder: "asc",
      },
    });

    const answers = questions.map((question) => ({
      questionId: question.id,
      answer: question.correctAnswer,
    }));

    const firstSubmit = await request(app)
      .post(`/assessment/${assessment.id}/submit`)
      .set("Authorization", `Bearer ${token}`)
      .send({
        resultId,
        answers,
      });

    expect(firstSubmit.status).toBe(200);

    const secondSubmit = await request(app)
      .post(`/assessment/${assessment.id}/submit`)
      .set("Authorization", `Bearer ${token}`)
      .send({
        resultId,
        answers,
      });

    expect(secondSubmit.status).toBe(409);

    expect(secondSubmit.body.message).toBe(
      "Assessment has already been submitted",
    );
  });

  it("Should reject submission with incomplete answers", async () => {
    const jobSeeker = await prisma.user.create({
      data: {
        name: "Incomplete Submission User",
        email: `incomplete-submit-${Date.now()}@test.com`,
        password: "test-password",
        role: "JOB_SEEKER",
      },
    });

    testUserId = jobSeeker.id;

    await createActiveSubscription(jobSeeker.id);

    const assessment = await createTestAssessment();

    await create25Questions(assessment.id);

    const token = createToken(jobSeeker);

    const startResponse = await request(app)
      .post(`/assessment/${assessment.id}/start`)
      .set("Authorization", `Bearer ${token}`);

    expect(startResponse.status).toBe(201);

    const resultId = startResponse.body.data.resultId;

    const questions = await prisma.skillAssessmentQuestion.findMany({
      where: {
        assessmentId: assessment.id,
      },
      orderBy: {
        questionOrder: "asc",
      },
    });

    const answers = questions.slice(0, 24).map((question) => ({
      questionId: question.id,
      answer: question.correctAnswer,
    }));

    const response = await request(app)
      .post(`/assessment/${assessment.id}/submit`)
      .set("Authorization", `Bearer ${token}`)
      .send({
        resultId,
        answers,
      });

    expect(response.status).toBe(400);
  });

  it("Should reject answers containing questions from another assessment", async () => {
    const jobSeeker = await prisma.user.create({
      data: {
        name: "Wrong Question Assessment User",
        email: `wrong-question-${Date.now()}@test.com`,
        password: "test-password",
        role: "JOB_SEEKER",
      },
    });

    testUserId = jobSeeker.id;

    await createActiveSubscription(jobSeeker.id);

    const assessment = await createTestAssessment();
    await create25Questions(assessment.id);

    const otherAssessment = await prisma.skillAssessment.create({
      data: {
        skillName: `OtherSkill-${Date.now()}`,
        title: "Other Assessment",
        description: "Another assessment",
      },
    });

    const otherQuestion = await prisma.skillAssessmentQuestion.create({
      data: {
        assessmentId: otherAssessment.id,
        question: "Question from another assessment",
        options: {
          A: "A",
          B: "B",
          C: "C",
          D: "D",
        },
        correctAnswer: "A",
        questionOrder: 1,
      },
    });

    const token = createToken(jobSeeker);

    const startResponse = await request(app)
      .post(`/assessment/${assessment.id}/start`)
      .set("Authorization", `Bearer ${token}`);

    expect(startResponse.status).toBe(201);

    const resultId = startResponse.body.data.resultId;

    const questions = await prisma.skillAssessmentQuestion.findMany({
      where: {
        assessmentId: assessment.id,
      },
      orderBy: {
        questionOrder: "asc",
      },
    });

    const answers = questions.map((question) => ({
      questionId: question.id,
      answer: question.correctAnswer,
    }));

    // Replace one valid question with one from another assessment
    answers[0] = {
      questionId: otherQuestion.id,
      answer: otherQuestion.correctAnswer,
    };

    const response = await request(app)
      .post(`/assessment/${assessment.id}/submit`)
      .set("Authorization", `Bearer ${token}`)
      .send({
        resultId,
        answers,
      });

    expect(response.status).toBe(400);

    expect(response.body.message).toBe(
      "One or more questions do not belong to this assessment",
    );
  });

  it("Should return earned badges for passed assessments", async () => {
    const jobSeeker = await prisma.user.create({
      data: {
        name: "Badge Test User",
        email: `badge-user-${Date.now()}@test.com`,
        password: "test-password",
        role: "JOB_SEEKER",
      },
    });

    testUserId = jobSeeker.id;

    const assessment = await createTestAssessment();

    const completedAt = new Date();

    const result = await prisma.skillAssessmentResult.create({
      data: {
        userId: jobSeeker.id,
        assessmentId: assessment.id,
        score: 88,
        isPassed: true,
        startedAt: new Date(Date.now() - 20 * 60 * 1000),
        completedAt,
        badgeName: `${assessment.skillName} Skill Badge`,
      },
    });

    const token = createToken(jobSeeker);

    const response = await request(app)
      .get("/assessment/badges")
      .set("Authorization", `Bearer ${token}`);

    expect(response.status).toBe(200);

    expect(response.body.message).toBe("User badges retrieved successfully");

    expect(response.body.data).toHaveLength(1);

    expect(response.body.data[0]).toMatchObject({
      resultId: result.id,
      assessmentId: assessment.id,
      skillName: assessment.skillName,
      assessmentTitle: assessment.title,
      badgeName: `${assessment.skillName} Skill Badge`,
      score: 88,
    });
  });

  it("Should not return badges for failed assessments", async () => {
    const jobSeeker = await prisma.user.create({
      data: {
        name: "Failed Badge User",
        email: `failed-badge-${Date.now()}@test.com`,
        password: "test-password",
        role: "JOB_SEEKER",
      },
    });

    testUserId = jobSeeker.id;

    const assessment = await createTestAssessment();

    await prisma.skillAssessmentResult.create({
      data: {
        userId: jobSeeker.id,
        assessmentId: assessment.id,
        score: 60,
        isPassed: false,
        startedAt: new Date(Date.now() - 20 * 60 * 1000),
        completedAt: new Date(),
        badgeName: null,
      },
    });

    const token = createToken(jobSeeker);

    const response = await request(app)
      .get("/assessment/badges")
      .set("Authorization", `Bearer ${token}`);

    expect(response.status).toBe(200);

    expect(response.body.data).toEqual([]);
  });

  it("Should return only one badge for multiple passed attempts of the same assessment", async () => {
    const jobSeeker = await prisma.user.create({
      data: {
        name: "Retake Badge User",
        email: `retake-badge-${Date.now()}@test.com`,
        password: "test-password",
        role: "JOB_SEEKER",
      },
    });

    testUserId = jobSeeker.id;

    const assessment = await createTestAssessment();

    await prisma.skillAssessmentResult.createMany({
      data: [
        {
          userId: jobSeeker.id,
          assessmentId: assessment.id,
          score: 80,
          isPassed: true,
          startedAt: new Date(Date.now() - 40 * 60 * 1000),
          completedAt: new Date(Date.now() - 20 * 60 * 1000),
          badgeName: `${assessment.skillName} Skill Badge`,
        },
        {
          userId: jobSeeker.id,
          assessmentId: assessment.id,
          score: 92,
          isPassed: true,
          startedAt: new Date(Date.now() - 15 * 60 * 1000),
          completedAt: new Date(),
          badgeName: `${assessment.skillName} Skill Badge`,
        },
      ],
    });

    const token = createToken(jobSeeker);

    const response = await request(app)
      .get("/assessment/badges")
      .set("Authorization", `Bearer ${token}`);

    expect(response.status).toBe(200);

    expect(response.body.data).toHaveLength(1);

    expect(response.body.data[0]).toMatchObject({
      assessmentId: assessment.id,
      skillName: assessment.skillName,
      badgeName: `${assessment.skillName} Skill Badge`,
      score: 92,
    });
  });

  it("Should return empty badge list when user has no earned badges", async () => {
    const jobSeeker = await prisma.user.create({
      data: {
        name: "No Badge User",
        email: `no-badge-${Date.now()}@test.com`,
        password: "test-password",
        role: "JOB_SEEKER",
      },
    });

    testUserId = jobSeeker.id;

    const token = createToken(jobSeeker);

    const response = await request(app)
      .get("/assessment/badges")
      .set("Authorization", `Bearer ${token}`);

    expect(response.status).toBe(200);

    expect(response.body.message).toBe("User badges retrieved successfully");

    expect(response.body.data).toEqual([]);
  });

  it("Should not return badges belonging to another user", async () => {
    const firstUser = await prisma.user.create({
      data: {
        name: "Badge Owner",
        email: `badge-owner-${Date.now()}@test.com`,
        password: "test-password",
        role: "JOB_SEEKER",
      },
    });

    const secondUser = await prisma.user.create({
      data: {
        name: "Badge Viewer",
        email: `badge-viewer-${Date.now()}@test.com`,
        password: "test-password",
        role: "JOB_SEEKER",
      },
    });

    // Register both users for afterEach cleanup
    testUserId = firstUser.id;
    additionalTestUserId = secondUser.id;

    const assessment = await createTestAssessment();

    // Only firstUser owns this badge
    await prisma.skillAssessmentResult.create({
      data: {
        userId: firstUser.id,
        assessmentId: assessment.id,
        score: 92,
        isPassed: true,
        startedAt: new Date(Date.now() - 20 * 60 * 1000),
        completedAt: new Date(),
        badgeName: `${assessment.skillName} Skill Badge`,
      },
    });

    // Authenticate as secondUser
    const token = createToken(secondUser);

    const response = await request(app)
      .get("/assessment/badges")
      .set("Authorization", `Bearer ${token}`);

    expect(response.status).toBe(200);

    // secondUser must not see firstUser's badge
    expect(response.body.data).toEqual([]);
  });
});
