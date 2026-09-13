import { afterAll, afterEach, describe, expect, it } from "vitest";

import { prisma } from "../lib/prisma.js";
import { getApplicantListService } from "../services/applicant-management/applicant-list.service.js";

const testUserIds: number[] = [];
const testCompanyIds: number[] = [];
const testJobIds: number[] = [];
const testApplicationIds: number[] = [];
const testUserSubscriptionIds: number[] = [];

const createJobSeeker = async (name: string) => {
  const user = await prisma.user.create({
    data: {
      name,
      email: `priority-${name.toLowerCase().replace(/\s+/g, "-")}-${Date.now()}-${Math.random()}@test.com`,
      password: "test-password",
      role: "JOB_SEEKER",
    },
  });

  testUserIds.push(user.id);

  return user;
};

const createCompanyAndJob = async () => {
  const companyAdmin = await prisma.user.create({
    data: {
      name: "Priority Test Company Admin",
      email: `priority-company-${Date.now()}-${Math.random()}@test.com`,
      password: "test-password",
      role: "COMPANY_ADMIN",
    },
  });

  testUserIds.push(companyAdmin.id);

  const company = await prisma.company.create({
    data: {
      userId: companyAdmin.id,
      companyName: "Priority Test Company",
      phone: "081234567890",
      profileContent: "Company for applicant priority testing",
      city: "Jakarta",
    },
  });

  testCompanyIds.push(company.id);

  const job = await prisma.jobPosting.create({
    data: {
      companyId: company.id,
      title: "Backend Developer",
      slug: `priority-backend-${Date.now()}-${Math.random()}`,
      description: "Backend developer priority test job",
      category: "TECHNOLOGY",
      cityLocation: "Jakarta",
      deadline: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      isPublished: true,
    },
  });

  testJobIds.push(job.id);

  return { companyAdmin, company, job };
};

const createApplication = async (
  userId: number,
  jobId: number,
  createdAt: Date,
) => {
  const application = await prisma.jobApplication.create({
    data: {
      userId,
      jobId,
      cvFile: "test-cv.pdf",
      status: "PENDING",
      createdAt,
    },
  });

  testApplicationIds.push(application.id);

  return application;
};

const getPlan = async (name: "STANDARD" | "PROFESSIONAL") => {
  return prisma.subscription.upsert({
    where: {
      name,
    },
    update: {},
    create: {
      name,
      price: name === "STANDARD" ? 25000 : 100000,
      durationDays: 30,
      featuresAccess:
        name === "STANDARD"
          ? {
              cvGenerator: true,
              skillAssessmentLimit: 2,
            }
          : {
              cvGenerator: true,
              skillAssessmentLimit: null,
              priorityReview: true,
            },
    },
  });
};

const createActiveSubscription = async (
  userId: number,
  planName: "STANDARD" | "PROFESSIONAL",
  endDate = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
) => {
  const plan = await getPlan(planName);

  const userSubscription = await prisma.userSubscription.create({
    data: {
      userId,
      subscriptionId: plan.id,
      status: "ACTIVE",
      paymentStatus: "settlement",
      startDate: new Date(),
      endDate,
    },
  });

  testUserSubscriptionIds.push(userSubscription.id);

  return userSubscription;
};

const defaultQuery = {
  page: 1,
  limit: 10,
  sortBy: "createdAt" as const,
  sortOrder: "desc" as const,
};

describe("Applicant priority review", () => {
  afterEach(async () => {
    if (testUserSubscriptionIds.length > 0) {
      await prisma.userSubscription.deleteMany({
        where: {
          id: {
            in: testUserSubscriptionIds,
          },
        },
      });

      testUserSubscriptionIds.length = 0;
    }

    if (testApplicationIds.length > 0) {
      await prisma.jobApplication.deleteMany({
        where: {
          id: {
            in: testApplicationIds,
          },
        },
      });

      testApplicationIds.length = 0;
    }

    if (testJobIds.length > 0) {
      await prisma.jobPosting.deleteMany({
        where: {
          id: {
            in: testJobIds,
          },
        },
      });

      testJobIds.length = 0;
    }

    if (testCompanyIds.length > 0) {
      await prisma.company.deleteMany({
        where: {
          id: {
            in: testCompanyIds,
          },
        },
      });

      testCompanyIds.length = 0;
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

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it("places an active Professional applicant before a newer regular applicant", async () => {
    const { job } = await createCompanyAndJob();

    const professionalUser = await createJobSeeker("Professional Applicant");
    const regularUser = await createJobSeeker("Regular Applicant");

    await createActiveSubscription(professionalUser.id, "PROFESSIONAL");

    await createApplication(
      professionalUser.id,
      job.id,
      new Date(Date.now() - 60 * 60 * 1000),
    );

    await createApplication(regularUser.id, job.id, new Date());

    const result = await getApplicantListService(job.id, defaultQuery);

    expect(result.data).toHaveLength(2);

    expect(result.data[0].applicant.id).toBe(professionalUser.id);
    expect(result.data[0].priorityReview).toBe(true);

    expect(result.data[1].applicant.id).toBe(regularUser.id);
    expect(result.data[1].priorityReview).toBe(false);
  });

  it("does not give priority to a Standard subscriber", async () => {
    const { job } = await createCompanyAndJob();

    const standardUser = await createJobSeeker("Standard Applicant");

    await createActiveSubscription(standardUser.id, "STANDARD");

    await createApplication(standardUser.id, job.id, new Date());

    const result = await getApplicantListService(job.id, defaultQuery);

    expect(result.data).toHaveLength(1);
    expect(result.data[0].applicant.id).toBe(standardUser.id);
    expect(result.data[0].priorityReview).toBe(false);
  });

  it("does not give priority to an expired Professional subscription", async () => {
    const { job } = await createCompanyAndJob();

    const expiredProfessionalUser = await createJobSeeker(
      "Expired Professional",
    );

    await createActiveSubscription(
      expiredProfessionalUser.id,
      "PROFESSIONAL",
      new Date(Date.now() - 60 * 1000),
    );

    await createApplication(expiredProfessionalUser.id, job.id, new Date());

    const result = await getApplicantListService(job.id, defaultQuery);

    expect(result.data).toHaveLength(1);
    expect(result.data[0].applicant.id).toBe(expiredProfessionalUser.id);
    expect(result.data[0].priorityReview).toBe(false);
  });

  it("keeps the existing sorting behavior inside the priority group", async () => {
    const { job } = await createCompanyAndJob();

    const olderProfessional = await createJobSeeker("Older Professional");
    const newerProfessional = await createJobSeeker("Newer Professional");

    await createActiveSubscription(olderProfessional.id, "PROFESSIONAL");
    await createActiveSubscription(newerProfessional.id, "PROFESSIONAL");

    await createApplication(
      olderProfessional.id,
      job.id,
      new Date(Date.now() - 2 * 60 * 60 * 1000),
    );

    await createApplication(
      newerProfessional.id,
      job.id,
      new Date(Date.now() - 60 * 60 * 1000),
    );

    const result = await getApplicantListService(job.id, defaultQuery);

    expect(result.data).toHaveLength(2);

    expect(result.data[0].applicant.id).toBe(newerProfessional.id);
    expect(result.data[1].applicant.id).toBe(olderProfessional.id);

    expect(result.data[0].priorityReview).toBe(true);
    expect(result.data[1].priorityReview).toBe(true);
  });

  it("keeps Professional applicants ahead of regular applicants across pagination", async () => {
    const { job } = await createCompanyAndJob();

    const professionalUser = await createJobSeeker("Paged Professional");
    const firstRegularUser = await createJobSeeker("Paged Regular One");
    const secondRegularUser = await createJobSeeker("Paged Regular Two");

    await createActiveSubscription(professionalUser.id, "PROFESSIONAL");

    await createApplication(
      professionalUser.id,
      job.id,
      new Date(Date.now() - 3 * 60 * 60 * 1000),
    );

    await createApplication(
      firstRegularUser.id,
      job.id,
      new Date(Date.now() - 60 * 60 * 1000),
    );

    await createApplication(secondRegularUser.id, job.id, new Date());

    const pageOne = await getApplicantListService(job.id, {
      ...defaultQuery,
      page: 1,
      limit: 2,
    });

    const pageTwo = await getApplicantListService(job.id, {
      ...defaultQuery,
      page: 2,
      limit: 2,
    });

    expect(pageOne.data).toHaveLength(2);
    expect(pageTwo.data).toHaveLength(1);

    expect(pageOne.data[0].applicant.id).toBe(professionalUser.id);
    expect(pageOne.data[0].priorityReview).toBe(true);

    expect(pageOne.data[1].applicant.id).toBe(secondRegularUser.id);
    expect(pageOne.data[1].priorityReview).toBe(false);

    expect(pageTwo.data[0].applicant.id).toBe(firstRegularUser.id);
    expect(pageTwo.data[0].priorityReview).toBe(false);

    expect(pageOne.meta.total).toBe(3);
    expect(pageOne.meta.totalPage).toBe(2);
  });
});
