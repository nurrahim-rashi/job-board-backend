import request from "supertest";
import { describe, expect, it } from "vitest";

import app from "../app.js";
import {
  createAuthToken,
  createTestCompany,
  createTestEmail,
  createTestSeeker,
  setupApiIntegrationLifecycle,
  testMarker,
} from "./helpers/api-integration.fixture.js";

setupApiIntegrationLifecycle();

describe("Applicant and company profiles", () => {
  it("updates all required applicant fields and makes safe fields public", async () => {
    const user = await createTestSeeker("complete-profile", {
      emailVerifiedAt: new Date(),
    });

    const update = await request(app)
      .patch("/auth/profile")
      .set("Authorization", `Bearer ${createAuthToken(user)}`)
      .send({
        name: "Complete Applicant",
        birthDate: "2000-01-02",
        gender: "FEMALE",
        lastEducation: "Bachelor in Computer Science at Polaris University",
        address: "Jalan Polaris 1",
        city: "Jakarta",
        province: "Jakarta",
        skills: ["TypeScript", "Product Design"],
        profileStory: "I build thoughtful products.",
      });
    expect(update.status).toBe(200);

    const profile = await request(app).get(`/profiles/${user.id}`);
    expect(profile.status).toBe(200);
    expect(profile.body.data).toMatchObject({
      id: user.id,
      name: "Complete Applicant",
      lastEducation: "Bachelor in Computer Science at Polaris University",
      city: "Jakarta",
      skills: ["TypeScript", "Product Design"],
    });
    expect(profile.body.data).not.toHaveProperty("birthDate");
    expect(profile.body.data).not.toHaveProperty("address");
  });

  it("requires email verification again after an address change", async () => {
    const user = await createTestSeeker("email-change", {
      emailVerifiedAt: new Date(),
    });
    const changedEmail = createTestEmail("changed-email");

    const response = await request(app)
      .patch("/auth/profile")
      .set("Authorization", `Bearer ${createAuthToken(user)}`)
      .send({ email: changedEmail });

    expect(response.status).toBe(200);
    expect(response.body.data.email).toBe(changedEmail);
    expect(response.body.data.emailVerifiedAt).toBeNull();
  });

  it("hides a private applicant profile from the public but not its owner", async () => {
    const user = await createTestSeeker("private-profile", {
      isPublicProfile: false,
    });

    const publicResponse = await request(app).get(`/profiles/${user.id}`);
    expect(publicResponse.status).toBe(404);

    const ownerResponse = await request(app)
      .get(`/profiles/${user.id}`)
      .set("Authorization", `Bearer ${createAuthToken(user)}`);
    expect(ownerResponse.status).toBe(200);
    expect(ownerResponse.body.data.id).toBe(user.id);
  });

  it("lets a company admin maintain rich company profile content", async () => {
    const { admin, company } = await createTestCompany("Editable Profile");
    const response = await request(app)
      .patch("/auth/profile")
      .set("Authorization", `Bearer ${createAuthToken(admin)}`)
      .send({
        companyName: `${testMarker} Updated Company`,
        phone: "089876543210",
        profileContent: "<h2>What we build</h2><p>Reliable products.</p>",
        companyCity: "Bandung",
        companyProvince: "West Java",
        companyCountry: "Indonesia",
        companyWebsite: "https://example.test",
        companyValues: ["Integrity", "Quality"],
        companyPerks: ["Learning budget"],
      });

    expect(response.status).toBe(200);
    expect(response.body.data.company).toMatchObject({
      id: company.id,
      companyName: `${testMarker} Updated Company`,
      city: "Bandung",
      province: "West Java",
      profileContent: "<h2>What we build</h2><p>Reliable products.</p>",
      values: ["Integrity", "Quality"],
    });
  });

  it("rejects unsupported avatar file types", async () => {
    const user = await createTestSeeker("invalid-avatar");
    const response = await request(app)
      .put("/auth/avatar")
      .set("Authorization", `Bearer ${createAuthToken(user)}`)
      .set("Content-Type", "application/pdf")
      .send(Buffer.from("not an image"));

    expect(response.status).toBe(400);
    expect(response.body.message).toContain("JPG, JPEG, or PNG");
  });
});
