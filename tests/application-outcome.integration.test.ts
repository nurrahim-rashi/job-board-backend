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

const pdf = Buffer.from("%PDF-1.4 application outcome test");

const applicant = () =>
  createTestSeeker("outcome", {
    emailVerifiedAt: new Date(),
    birthDate: new Date("1998-05-04"),
    gender: "FEMALE",
    lastEducation: "Bachelor in Engineering at Polaris University",
    address: "Jalan Polaris 7",
    city: "Jakarta",
    province: "Jakarta",
  });

async function applyToNewJob(label: string) {
  const user = await applicant();
  const { company } = await createTestCompany(label);
  const job = await createTestJob(company.id, label);
  const auth = createAuthToken(user);

  const applied = await request(app)
    .post(`/jobs/${job.slug}/applications`)
    .set("Authorization", `Bearer ${auth}`)
    .attach("cv", pdf, {
      filename: "application.pdf",
      contentType: "application/pdf",
    });
  expect(applied.status).toBe(201);

  return { user, auth, job, applicationId: applied.body.data.id as number };
}

setupApiIntegrationLifecycle();

describe("Accepted application outcome", () => {
  it("shows the applicant their interview schedule once one is booked", async () => {
    const { auth, applicationId } = await applyToNewJob("Interview Outcome");
    const interviewDate = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000);

    await prisma.jobApplication.update({
      where: { id: applicationId },
      data: { status: "ACCEPTED" },
    });
    await prisma.interview.create({
      data: {
        jobApplicationId: applicationId,
        interviewDate,
        locationOrLink: "https://meet.example.test/polaris-interview",
        status: "SCHEDULED",
      },
    });

    const detail = await request(app)
      .get(`/applications/me/${applicationId}`)
      .set("Authorization", `Bearer ${auth}`);

    expect(detail.status).toBe(200);
    expect(detail.body.data.status).toBe("ACCEPTED");
    expect(detail.body.data.interview).toMatchObject({
      locationOrLink: "https://meet.example.test/polaris-interview",
      status: "SCHEDULED",
    });
    expect(new Date(detail.body.data.interview.interviewDate).getTime()).toBe(
      interviewDate.getTime(),
    );
  });

  it("returns a null interview while none is booked", async () => {
    const { auth, applicationId } = await applyToNewJob("No Interview Yet");

    const detail = await request(app)
      .get(`/applications/me/${applicationId}`)
      .set("Authorization", `Bearer ${auth}`);

    expect(detail.status).toBe(200);
    expect(detail.body.data.interview).toBeNull();
  });

  it("does not expose another applicant's application", async () => {
    const { applicationId } = await applyToNewJob("Private Outcome");
    const stranger = await applicant();

    const detail = await request(app)
      .get(`/applications/me/${applicationId}`)
      .set("Authorization", `Bearer ${createAuthToken(stranger)}`);

    expect(detail.status).toBe(404);
  });
});

describe("CV upload rules", () => {
  it("refuses a CV that is not a PDF", async () => {
    const user = await applicant();
    const { company } = await createTestCompany("CV Type");
    const job = await createTestJob(company.id, "CV Type");

    const response = await request(app)
      .post(`/jobs/${job.slug}/applications`)
      .set("Authorization", `Bearer ${createAuthToken(user)}`)
      .attach("cv", Buffer.from("just some text"), {
        filename: "cv.txt",
        contentType: "text/plain",
      });

    expect(response.status).toBe(400);
    expect(
      await prisma.jobApplication.count({ where: { userId: user.id } }),
    ).toBe(0);
  });

  it("refuses a CV larger than the upload limit", async () => {
    const user = await applicant();
    const { company } = await createTestCompany("CV Size");
    const job = await createTestJob(company.id, "CV Size");
    const oversize = Buffer.concat([pdf, Buffer.alloc(1024 * 1024, 32)]);

    const response = await request(app)
      .post(`/jobs/${job.slug}/applications`)
      .set("Authorization", `Bearer ${createAuthToken(user)}`)
      .attach("cv", oversize, {
        filename: "cv.pdf",
        contentType: "application/pdf",
      });

    expect(response.status).toBe(400);
    expect(
      await prisma.jobApplication.count({ where: { userId: user.id } }),
    ).toBe(0);
  });

  it("requires a CV file at all", async () => {
    const user = await applicant();
    const { company } = await createTestCompany("CV Missing");
    const job = await createTestJob(company.id, "CV Missing");

    const response = await request(app)
      .post(`/jobs/${job.slug}/applications`)
      .set("Authorization", `Bearer ${createAuthToken(user)}`)
      .field("expectedSalary", "12000000");

    expect(response.status).toBe(400);
  });
});

describe("Paginated application list", () => {
  it("splits the applicant's applications into pages", async () => {
    const user = await applicant();
    const { company } = await createTestCompany("Application Pages");
    const auth = createAuthToken(user);

    for (let index = 0; index < 3; index += 1) {
      const job = await createTestJob(company.id, `Paged ${index}`);
      const applied = await request(app)
        .post(`/jobs/${job.slug}/applications`)
        .set("Authorization", `Bearer ${auth}`)
        .attach("cv", pdf, {
          filename: "application.pdf",
          contentType: "application/pdf",
        });
      expect(applied.status).toBe(201);
    }

    const firstPage = await request(app)
      .get("/applications/me/page")
      .query({ page: 1, limit: 2 })
      .set("Authorization", `Bearer ${auth}`);

    expect(firstPage.status).toBe(200);
    expect(firstPage.body.data.items).toHaveLength(2);
    expect(firstPage.body.data.pagination).toMatchObject({
      page: 1,
      limit: 2,
      total: 3,
      totalPages: 2,
    });

    const secondPage = await request(app)
      .get("/applications/me/page")
      .query({ page: 2, limit: 2 })
      .set("Authorization", `Bearer ${auth}`);

    expect(secondPage.status).toBe(200);
    expect(secondPage.body.data.items).toHaveLength(1);
    expect(secondPage.body.data.pagination.page).toBe(2);

    const firstIds = firstPage.body.data.items.map(
      (item: { id: number }) => item.id,
    );
    const secondIds = secondPage.body.data.items.map(
      (item: { id: number }) => item.id,
    );
    // The pages must not repeat an application.
    expect(firstIds).not.toEqual(expect.arrayContaining(secondIds));
  });

  it("requires authentication", async () => {
    const response = await request(app).get("/applications/me/page");
    expect(response.status).toBe(401);
  });
});
