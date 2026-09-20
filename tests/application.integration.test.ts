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

const pdf = Buffer.from("%PDF-1.4 integration test");

describe("Job applications", () => {
  it("requires authentication before accepting an application", async () => {
    const { company } = await createTestCompany("Anonymous Apply");
    const job = await createTestJob(company.id, "Protected Apply");

    const response = await request(app)
      .post(`/jobs/${job.slug}/applications`)
      .attach("cv", pdf, {
        filename: "application.pdf",
        contentType: "application/pdf",
      });

    expect(response.status).toBe(401);
  });

  it("blocks applicants whose email is not verified", async () => {
    const { company } = await createTestCompany("Verification Protection");
    const job = await createTestJob(company.id, "Verified Applicants");
    const user = await createTestSeeker("unverified-apply", {
      birthDate: new Date("2000-01-02"),
      gender: "FEMALE",
      lastEducation: "Bachelor in Design at Polaris University",
      address: "Jalan Polaris 1",
      city: "Jakarta",
      province: "Jakarta",
    });

    const response = await request(app)
      .post(`/jobs/${job.slug}/applications`)
      .set("Authorization", `Bearer ${createAuthToken(user)}`)
      .attach("cv", pdf, {
        filename: "application.pdf",
        contentType: "application/pdf",
      });

    expect(response.status).toBe(403);
    expect(response.body.message).toContain("Verify your email");
  });

  it("requires the mandatory applicant profile fields", async () => {
    const { company } = await createTestCompany("Profile Protection");
    const job = await createTestJob(company.id, "Complete Profiles");
    const user = await createTestSeeker("incomplete-apply", {
      emailVerifiedAt: new Date(),
    });

    const response = await request(app)
      .post(`/jobs/${job.slug}/applications`)
      .set("Authorization", `Bearer ${createAuthToken(user)}`)
      .attach("cv", pdf, {
        filename: "application.pdf",
        contentType: "application/pdf",
      });

    expect(response.status).toBe(400);
    expect(response.body.message).toContain("Complete your birth date");
  });

  it("submits a PDF, snapshots education, and lists the application status", async () => {
    const education = "Bachelor in Computer Science at Polaris University";
    const user = await createTestSeeker("successful-apply", {
      emailVerifiedAt: new Date(),
      birthDate: new Date("2000-01-02"),
      gender: "FEMALE",
      lastEducation: education,
      address: "Jalan Polaris 1",
      city: "Jakarta",
      province: "Jakarta",
      country: "Indonesia",
    });
    const { company } = await createTestCompany("Application");
    const job = await createTestJob(company.id, "Application Flow", {
      salaryCurrency: "USD",
    });
    const auth = createAuthToken(user);

    const applied = await request(app)
      .post(`/jobs/${job.slug}/applications`)
      .set("Authorization", `Bearer ${auth}`)
      .field("expectedSalary", "15000000")
      .field("expectedSalaryCurrency", "IDR")
      .attach("cv", pdf, {
        filename: "application.pdf",
        contentType: "application/pdf",
      });
    expect(applied.status).toBe(201);
    expect(applied.body.data).toMatchObject({
      status: "PENDING",
      expectedSalary: 15_000_000,
      expectedSalaryCurrency: "USD",
      job: { id: job.id },
    });

    const stored = await prisma.jobApplication.findUniqueOrThrow({
      where: { id: applied.body.data.id },
    });
    expect(stored.lastEducationSnapshot).toBe(education);
    expect(stored.expectedSalaryCurrency).toBe("USD");

    await prisma.user.update({
      where: { id: user.id },
      data: { lastEducation: "Master in AI at Another University" },
    });
    const unchanged = await prisma.jobApplication.findUniqueOrThrow({
      where: { id: stored.id },
    });
    expect(unchanged.lastEducationSnapshot).toBe(education);

    const applications = await request(app)
      .get("/applications/me")
      .set("Authorization", `Bearer ${auth}`);
    expect(applications.status).toBe(200);
    expect(applications.body.data).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: stored.id,
          status: "PENDING",
          expectedSalaryCurrency: "USD",
        }),
      ]),
    );

    const updatedSalary = await request(app)
      .patch(`/applications/me/${stored.id}/expected-salary`)
      .set("Authorization", `Bearer ${auth}`)
      .send({ expectedSalary: 16_000_000, expectedSalaryCurrency: "IDR" });
    expect(updatedSalary.status).toBe(200);
    expect(updatedSalary.body.data).toMatchObject({
      expectedSalary: 16_000_000,
      expectedSalaryCurrency: "USD",
    });
  });

  it("shows rejection details and prevents duplicate applications", async () => {
    const user = await createTestSeeker("rejected-application", {
      emailVerifiedAt: new Date(),
      birthDate: new Date("2000-01-02"),
      gender: "MALE",
      lastEducation: "Bachelor in Engineering at Polaris University",
      address: "Jalan Polaris 2",
      city: "Jakarta",
      province: "Jakarta",
      country: "Indonesia",
    });
    const { company } = await createTestCompany("Rejection");
    const job = await createTestJob(company.id, "Rejection Flow");
    const auth = createAuthToken(user);

    const applied = await request(app)
      .post(`/jobs/${job.slug}/applications`)
      .set("Authorization", `Bearer ${auth}`)
      .attach("cv", pdf, {
        filename: "application.pdf",
        contentType: "application/pdf",
      });
    expect(applied.status).toBe(201);

    await prisma.jobApplication.update({
      where: { id: applied.body.data.id },
      data: {
        status: "REJECTED",
        rejectionReason: "The role requires a different specialization.",
      },
    });
    const detail = await request(app)
      .get(`/applications/me/${applied.body.data.id}`)
      .set("Authorization", `Bearer ${auth}`);
    expect(detail.status).toBe(200);
    expect(detail.body.data).toMatchObject({
      id: applied.body.data.id,
      status: "REJECTED",
      rejectionReason: "The role requires a different specialization.",
    });

    const duplicate = await request(app)
      .post(`/jobs/${job.slug}/applications`)
      .set("Authorization", `Bearer ${auth}`)
      .attach("cv", pdf, {
        filename: "duplicate.pdf",
        contentType: "application/pdf",
      });
    expect(duplicate.status).toBe(409);
  });
});
