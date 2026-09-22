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

describe("Saved jobs", () => {
  it("requires authentication before saving a job", async () => {
    const { company } = await createTestCompany("Anonymous Save");
    const job = await createTestJob(company.id, "Protected Save");

    const response = await request(app).post(`/jobs/${job.slug}/save`);

    expect(response.status).toBe(401);
  });

  it("404s when the job does not exist or is not currently open", async () => {
    const user = await createTestSeeker("save-missing-job");
    const auth = createAuthToken(user);
    const { company } = await createTestCompany("Closed Save");
    const closedJob = await createTestJob(company.id, "Closed Save Job", {
      deadline: new Date(Date.now() - 24 * 60 * 60 * 1000),
    });

    const missing = await request(app)
      .post("/jobs/does-not-exist/save")
      .set("Authorization", `Bearer ${auth}`);
    expect(missing.status).toBe(404);

    const closed = await request(app)
      .post(`/jobs/${closedJob.slug}/save`)
      .set("Authorization", `Bearer ${auth}`);
    expect(closed.status).toBe(404);
  });

  it("saves a job, lists it, and is idempotent on a second save", async () => {
    const user = await createTestSeeker("save-job-flow");
    const auth = createAuthToken(user);
    const { company } = await createTestCompany("Save Flow");
    const job = await createTestJob(company.id, "Save Flow Job");

    const saved = await request(app)
      .post(`/jobs/${job.slug}/save`)
      .set("Authorization", `Bearer ${auth}`);
    expect(saved.status).toBe(201);
    expect(saved.body.data).toMatchObject({ jobId: job.id });

    const savedAgain = await request(app)
      .post(`/jobs/${job.slug}/save`)
      .set("Authorization", `Bearer ${auth}`);
    expect(savedAgain.status).toBe(201);
    expect(savedAgain.body.data.id).toBe(saved.body.data.id);

    const rows = await prisma.savedJob.findMany({
      where: { userId: user.id, jobId: job.id },
    });
    expect(rows).toHaveLength(1);

    const ids = await request(app)
      .get("/saved-jobs/ids")
      .set("Authorization", `Bearer ${auth}`);
    expect(ids.status).toBe(200);
    expect(ids.body.data).toContain(job.id);

    const list = await request(app)
      .get("/saved-jobs")
      .set("Authorization", `Bearer ${auth}`);
    expect(list.status).toBe(200);
    expect(list.body.data.items).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ jobId: job.id, job: expect.objectContaining({ id: job.id }) }),
      ]),
    );
    expect(list.body.data.pagination.total).toBe(1);
  });

  it("removes a saved job and 404s when it was never saved", async () => {
    const user = await createTestSeeker("unsave-job-flow");
    const auth = createAuthToken(user);
    const { company } = await createTestCompany("Unsave Flow");
    const job = await createTestJob(company.id, "Unsave Flow Job");

    await request(app)
      .post(`/jobs/${job.slug}/save`)
      .set("Authorization", `Bearer ${auth}`);

    const removed = await request(app)
      .delete(`/jobs/${job.slug}/save`)
      .set("Authorization", `Bearer ${auth}`);
    expect(removed.status).toBe(200);

    const rows = await prisma.savedJob.findMany({
      where: { userId: user.id, jobId: job.id },
    });
    expect(rows).toHaveLength(0);

    const removedAgain = await request(app)
      .delete(`/jobs/${job.slug}/save`)
      .set("Authorization", `Bearer ${auth}`);
    expect(removedAgain.status).toBe(404);
  });

  it("keeps a saved job visible after the posting closes, but drops it once deleted", async () => {
    const user = await createTestSeeker("save-lifecycle");
    const auth = createAuthToken(user);
    const { company } = await createTestCompany("Save Lifecycle");
    const job = await createTestJob(company.id, "Save Lifecycle Job");

    await request(app)
      .post(`/jobs/${job.slug}/save`)
      .set("Authorization", `Bearer ${auth}`);

    await prisma.jobPosting.update({
      where: { id: job.id },
      data: { isPublished: false },
    });
    const afterClose = await request(app)
      .get("/saved-jobs/ids")
      .set("Authorization", `Bearer ${auth}`);
    expect(afterClose.body.data).toContain(job.id);

    await prisma.jobPosting.update({
      where: { id: job.id },
      data: { deletedAt: new Date() },
    });
    const afterDelete = await request(app)
      .get("/saved-jobs/ids")
      .set("Authorization", `Bearer ${auth}`);
    expect(afterDelete.body.data).not.toContain(job.id);
  });
});
