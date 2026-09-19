import request from "supertest";
import { describe, expect, it } from "vitest";

import app from "../app.js";
import { prisma } from "../lib/prisma.js";
import {
  createAuthToken,
  createTestCompany,
  createTestJob,
  createTestSeeker,
  setupApiIntegrationLifecycle,
} from "./helpers/api-integration.fixture.js";

setupApiIntegrationLifecycle();

describe("Personalized homepage", () => {
  it("prioritizes the user's city and excludes jobs they already applied to", async () => {
    const user = await createTestSeeker("homepage", {
      emailVerifiedAt: new Date(),
      city: "Bandung",
      province: "West Java",
    });
    const { company } = await createTestCompany("Bandung Homepage");
    const appliedJob = await createTestJob(company.id, "Already Applied", {
      cityLocation: "Bandung",
      provinceLocation: "West Java",
    });
    const matchingJob = await createTestJob(company.id, "Nearby Match", {
      cityLocation: "Bandung",
      provinceLocation: "West Java",
    });
    await createTestJob(company.id, "Remote Match", {
      cityLocation: "Surabaya",
      provinceLocation: "East Java",
    });
    await prisma.jobApplication.create({
      data: {
        userId: user.id,
        jobId: appliedJob.id,
        cvFile: "/uploads/cvs/existing.pdf",
        status: "PENDING",
      },
    });

    const response = await request(app)
      .get("/auth/homepage")
      .set("Authorization", `Bearer ${createAuthToken(user)}`);

    expect(response.status).toBe(200);
    expect(response.body.data.overview.name).toBe(user.name);
    expect(response.body.data.applications).toHaveLength(1);
    expect(response.body.data.recommendations[0]).toMatchObject({
      id: matchingJob.id,
      score: 92,
    });
    expect(
      response.body.data.recommendations.map((job: { id: number }) => job.id),
    ).not.toContain(appliedJob.id);
  });

  it("does not expose applicant homepage data to a company admin", async () => {
    const { admin } = await createTestCompany("Homepage Forbidden");
    const response = await request(app)
      .get("/auth/homepage")
      .set("Authorization", `Bearer ${createAuthToken(admin)}`);

    expect(response.status).toBe(403);
  });
});
