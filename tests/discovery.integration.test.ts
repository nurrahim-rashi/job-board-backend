import request from "supertest";
import { describe, expect, it } from "vitest";

import app from "../app.js";
import {
  createTestCompany,
  createTestJob,
  setupApiIntegrationLifecycle,
  testMarker,
} from "./helpers/api-integration.fixture.js";

setupApiIntegrationLifecycle();

describe("Job and company discovery", () => {
  it("returns only active published jobs, newest first, and honors the limit", async () => {
    const { company } = await createTestCompany("Discovery");
    const oldJob = await createTestJob(company.id, "Older Active", {
      createdAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000),
    });
    const newJob = await createTestJob(company.id, "Newest Active", {
      createdAt: new Date(),
    });
    await createTestJob(company.id, "Draft", { isPublished: false });
    await createTestJob(company.id, "Expired", {
      deadline: new Date(Date.now() - 60 * 60 * 1000),
    });

    const response = await request(app).get("/jobs").query({
      title: testMarker,
      sort: "newest",
      limit: 2,
    });

    expect(response.status).toBe(200);
    expect(response.body.data.map((job: { id: number }) => job.id)).toEqual([
      newJob.id,
      oldJob.id,
    ]);
  });

  it("filters jobs by title, category, city, and country", async () => {
    const { company } = await createTestCompany("Filters");
    const matching = await createTestJob(company.id, "Product Design", {
      category: "DESIGN",
      cityLocation: "Bandung",
      provinceLocation: "West Java",
      countryLocation: "Indonesia",
    });
    await createTestJob(company.id, "Finance", {
      category: "FINANCE",
      cityLocation: "Singapore",
      provinceLocation: "Singapore",
      countryLocation: "Singapore",
    });

    const filtered = await request(app).get("/jobs").query({
      title: "Product Design",
      category: "DESIGN",
      city: "Bandung",
      country: "Indonesia",
    });

    expect(filtered.status).toBe(200);
    expect(filtered.body.data).toHaveLength(1);
    expect(filtered.body.data[0].id).toBe(matching.id);
  });

  it("rejects invalid job category and incomplete coordinates", async () => {
    const invalidCategory = await request(app)
      .get("/jobs")
      .query({ category: "NOT_A_CATEGORY" });
    expect(invalidCategory.status).toBe(400);

    const incompleteCoordinates = await request(app)
      .get("/jobs")
      .query({ latitude: -6.2 });
    expect(incompleteCoordinates.status).toBe(400);
  });

  it("returns job detail, applicant count, hiring manager, and related roles", async () => {
    const { admin, company } = await createTestCompany("Job Detail");
    const main = await createTestJob(company.id, "Main Detail");
    const related = await createTestJob(company.id, "Related Detail");

    const response = await request(app).get(`/jobs/${main.slug}`);
    expect(response.status).toBe(200);
    expect(response.body.data).toMatchObject({
      id: main.id,
      applicantCount: 0,
      company: {
        id: company.id,
        companyName: company.companyName,
        postedBy: { id: admin.id },
      },
    });
    expect(
      response.body.data.relatedJobs.map((job: { id: number }) => job.id),
    ).toContain(related.id);

    const missing = await request(app).get(`/jobs/${testMarker}-missing`);
    expect(missing.status).toBe(404);
  });

  it("searches companies and includes active roles in company detail", async () => {
    const { company } = await createTestCompany("Bandung Studio");
    const role = await createTestJob(company.id, "Company Open Role", {
      cityLocation: "Bandung",
      provinceLocation: "West Java",
    });

    const list = await request(app).get("/companies").query({
      search: testMarker,
      city: "Bandung",
      country: "Indonesia",
    });
    expect(list.status).toBe(200);
    expect(list.body.data).toHaveLength(1);
    expect(list.body.data[0]).toMatchObject({
      id: company.id,
      city: "Bandung",
      country: "Indonesia",
    });

    const detail = await request(app).get(`/companies/${company.id}`);
    expect(detail.status).toBe(200);
    expect(detail.body.data.jobPostings).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: role.id, title: role.title }),
      ]),
    );
  });
});
