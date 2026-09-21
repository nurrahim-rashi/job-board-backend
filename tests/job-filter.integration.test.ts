import request from "supertest";
import { describe, expect, it } from "vitest";

import app from "../app.js";
import { prisma } from "../lib/prisma.js";
import {
  createTestCompany,
  createTestJob,
  setupApiIntegrationLifecycle,
  testMarker,
} from "./helpers/api-integration.fixture.js";

const daysAgo = (days: number) =>
  new Date(Date.now() - days * 24 * 60 * 60 * 1000);

const isoDate = (date: Date) => date.toISOString().slice(0, 10);

const jobIds = (body: { data: { id: number }[] }) =>
  body.data.map((job) => job.id);

setupApiIntegrationLifecycle();

describe("Job date filters", () => {
  it("keeps only postings from the last seven days", async () => {
    const { company } = await createTestCompany("Date Week");
    const today = await createTestJob(company.id, "Posted Today", {
      createdAt: new Date(),
    });
    const threeDays = await createTestJob(company.id, "Posted Three Days", {
      createdAt: daysAgo(3),
    });
    const lastMonth = await createTestJob(company.id, "Posted Last Month", {
      createdAt: daysAgo(30),
    });

    const response = await request(app)
      .get("/jobs")
      .query({ title: testMarker, dateFrom: isoDate(daysAgo(7)) });

    expect(response.status).toBe(200);
    const ids = jobIds(response.body);
    expect(ids).toEqual(expect.arrayContaining([today.id, threeDays.id]));
    expect(ids).not.toContain(lastMonth.id);
  });

  it("keeps only postings from the last month", async () => {
    const { company } = await createTestCompany("Date Month");
    const recent = await createTestJob(company.id, "Recent Month", {
      createdAt: daysAgo(10),
    });
    const old = await createTestJob(company.id, "Old Quarter", {
      createdAt: daysAgo(90),
    });

    const response = await request(app)
      .get("/jobs")
      .query({ title: testMarker, dateFrom: isoDate(daysAgo(30)) });

    expect(response.status).toBe(200);
    const ids = jobIds(response.body);
    expect(ids).toContain(recent.id);
    expect(ids).not.toContain(old.id);
  });

  it("honours a closed date range at both ends", async () => {
    const { company } = await createTestCompany("Date Range");
    const inside = await createTestJob(company.id, "Inside Range", {
      createdAt: daysAgo(15),
    });
    const tooNew = await createTestJob(company.id, "Too New", {
      createdAt: daysAgo(2),
    });
    const tooOld = await createTestJob(company.id, "Too Old", {
      createdAt: daysAgo(40),
    });

    const response = await request(app).get("/jobs").query({
      title: testMarker,
      dateFrom: isoDate(daysAgo(25)),
      dateTo: isoDate(daysAgo(5)),
    });

    expect(response.status).toBe(200);
    const ids = jobIds(response.body);
    expect(ids).toContain(inside.id);
    expect(ids).not.toContain(tooNew.id);
    expect(ids).not.toContain(tooOld.id);
  });

  it("includes postings made on the dateTo day itself", async () => {
    const { company } = await createTestCompany("Date Boundary");
    const boundaryDay = daysAgo(3);
    const onBoundary = await createTestJob(company.id, "On Boundary", {
      // Late in the day in the filter timezone (Asia/Jakarta), to catch a
      // dateTo that stops before the day is over there.
      createdAt: new Date(
        Date.UTC(
          boundaryDay.getUTCFullYear(),
          boundaryDay.getUTCMonth(),
          boundaryDay.getUTCDate(),
          15,
          30,
        ),
      ),
    });

    const response = await request(app)
      .get("/jobs")
      .query({ title: testMarker, dateTo: isoDate(boundaryDay) });

    expect(response.status).toBe(200);
    expect(jobIds(response.body)).toContain(onBoundary.id);
  });

  it("reads the range in the app timezone, not UTC", async () => {
    const { company } = await createTestCompany("Date Zone");
    const boundaryDay = daysAgo(3);
    // 06:00 the next morning in Asia/Jakarta. Parsing dateTo as UTC used to
    // pull this into the previous day's results.
    const nextMorningLocal = await createTestJob(company.id, "Next Morning", {
      createdAt: new Date(
        Date.UTC(
          boundaryDay.getUTCFullYear(),
          boundaryDay.getUTCMonth(),
          boundaryDay.getUTCDate(),
          23,
          0,
        ),
      ),
    });

    const response = await request(app)
      .get("/jobs")
      .query({ title: testMarker, dateTo: isoDate(boundaryDay) });

    expect(response.status).toBe(200);
    expect(jobIds(response.body)).not.toContain(nextMorningLocal.id);
  });

  it("rejects a malformed date range", async () => {
    const response = await request(app)
      .get("/jobs")
      .query({ dateFrom: "not-a-date" });

    expect(response.status).toBe(400);
    expect(response.body.message).toContain("date range is invalid");
  });
});

describe("Job sorting", () => {
  it("returns the oldest posting first when asked", async () => {
    const { company } = await createTestCompany("Sort Oldest");
    const older = await createTestJob(company.id, "Older Sort", {
      createdAt: daysAgo(5),
    });
    const newer = await createTestJob(company.id, "Newer Sort", {
      createdAt: daysAgo(1),
    });

    const response = await request(app)
      .get("/jobs")
      .query({ title: testMarker, sort: "oldest", limit: 2 });

    expect(response.status).toBe(200);
    expect(jobIds(response.body)).toEqual([older.id, newer.id]);
  });

  it("orders by distance from the caller's coordinates", async () => {
    const { company } = await createTestCompany("Sort Nearest");
    // Monas, Jakarta. The far job sits in Surabaya, roughly 660km away.
    const near = await createTestJob(company.id, "Near Job", {
      cityLocation: "Jakarta",
      latitude: "-6.1754",
      longitude: "106.8272",
    });
    const far = await createTestJob(company.id, "Far Job", {
      cityLocation: "Jakarta",
      latitude: "-7.2575",
      longitude: "112.7521",
    });

    const response = await request(app).get("/jobs").query({
      title: testMarker,
      city: "Jakarta",
      provinceName: "Jakarta",
      country: "Indonesia",
      sort: "nearest",
      latitude: -6.2,
      longitude: 106.8,
      limit: 2,
    });

    expect(response.status).toBe(200);
    expect(jobIds(response.body)).toEqual([near.id, far.id]);
    expect(response.body.data[0].distance).toBeLessThan(
      response.body.data[1].distance,
    );
  });

  it("requires latitude and longitude together", async () => {
    const missingLongitude = await request(app)
      .get("/jobs")
      .query({ latitude: -6.2 });
    expect(missingLongitude.status).toBe(400);

    const missingLatitude = await request(app)
      .get("/jobs")
      .query({ longitude: 106.8 });
    expect(missingLatitude.status).toBe(400);
  });
});

describe("Company sorting", () => {
  it("sorts companies by name in both directions", async () => {
    const first = await createTestCompany("Aardvark Studio");
    const last = await createTestCompany("Zephyr Works");

    const ascending = await request(app)
      .get("/companies")
      .query({ search: testMarker, sort: "asc" });
    expect(ascending.status).toBe(200);
    const ascendingNames = ascending.body.data.map(
      (company: { companyName: string }) => company.companyName,
    );
    expect(ascendingNames.indexOf(first.company.companyName)).toBeLessThan(
      ascendingNames.indexOf(last.company.companyName),
    );

    const descending = await request(app)
      .get("/companies")
      .query({ search: testMarker, sort: "desc" });
    expect(descending.status).toBe(200);
    const descendingNames = descending.body.data.map(
      (company: { companyName: string }) => company.companyName,
    );
    expect(descendingNames.indexOf(last.company.companyName)).toBeLessThan(
      descendingNames.indexOf(first.company.companyName),
    );
  });

  it("requires company coordinates to be given as a pair", async () => {
    const response = await request(app)
      .get("/companies")
      .query({ search: testMarker, latitude: -6.2 });

    expect(response.status).toBe(400);
  });
});

describe("Landing page job feed", () => {
  it("serves the newest postings for an anonymous visitor", async () => {
    const { company } = await createTestCompany("Landing Feed");
    const created = [];
    for (let index = 0; index < 6; index += 1) {
      created.push(
        await createTestJob(company.id, `Landing ${index}`, {
          createdAt: daysAgo(index),
        }),
      );
    }

    const response = await request(app)
      .get("/jobs")
      .query({ title: testMarker, limit: 5 });

    expect(response.status).toBe(200);
    expect(response.body.data).toHaveLength(5);
    // Newest first, and the sixth posting is left out by the limit.
    expect(jobIds(response.body)).toEqual(
      created.slice(0, 5).map((job) => job.id),
    );
  });

  it("hides drafts and closed postings from the public feed", async () => {
    const { company } = await createTestCompany("Landing Visibility");
    const draft = await createTestJob(company.id, "Landing Draft", {
      isPublished: false,
    });
    const closed = await createTestJob(company.id, "Landing Closed", {
      deadline: daysAgo(1),
    });
    const live = await createTestJob(company.id, "Landing Live");

    const response = await request(app)
      .get("/jobs")
      .query({ title: testMarker });

    expect(response.status).toBe(200);
    const ids = jobIds(response.body);
    expect(ids).toContain(live.id);
    expect(ids).not.toContain(draft.id);
    expect(ids).not.toContain(closed.id);

    // The drafts still exist; they are filtered, not deleted.
    expect(
      await prisma.jobPosting.count({ where: { id: draft.id } }),
    ).toBe(1);
  });
});
