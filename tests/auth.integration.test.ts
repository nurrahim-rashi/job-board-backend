import { randomUUID } from "node:crypto";

import request from "supertest";
import { describe, expect, it } from "vitest";

import app from "../app.js";
import { prisma } from "../lib/prisma.js";
import { hashToken } from "../utils/token.js";
import {
  createAuthToken,
  createTestEmail,
  createTestSeeker,
  setupApiIntegrationLifecycle,
  testMarker,
  validPassword,
} from "./helpers/api-integration.fixture.js";

setupApiIntegrationLifecycle();

describe("Authentication and authorization", () => {
  it("registers a job seeker and stores a hashed password plus a one-hour verification token", async () => {
    const email = createTestEmail("register-seeker");
    const before = Date.now();

    const response = await request(app).post("/auth/register").send({
      name: "Integration Seeker",
      email,
      password: validPassword,
      role: "JOB_SEEKER",
    });

    expect(response.status).toBe(201);
    expect(response.body.data.token).toEqual(expect.any(String));
    expect(response.body.data.user).toMatchObject({
      email,
      role: "JOB_SEEKER",
      emailVerifiedAt: null,
    });

    const stored = await prisma.user.findUniqueOrThrow({ where: { email } });
    expect(stored.password).toMatch(/^scrypt:/);
    expect(stored.password).not.toBe(validPassword);
    expect(stored.emailVerificationTokenHash).toMatch(/^[a-f0-9]{64}$/);
    expect(stored.emailVerificationExpiresAt!.getTime()).toBeGreaterThan(
      before + 59 * 60 * 1000,
    );
    expect(stored.emailVerificationExpiresAt!.getTime()).toBeLessThanOrEqual(
      Date.now() + 60 * 60 * 1000,
    );
  });

  it("requires company name and phone, then creates the company for a valid company registration", async () => {
    const invalid = await request(app).post("/auth/register").send({
      name: "Integration Hiring Admin",
      email: createTestEmail("invalid-company"),
      password: validPassword,
      role: "COMPANY_ADMIN",
    });
    expect(invalid.status).toBe(400);
    expect(invalid.body.message).toContain("companyName");
    expect(invalid.body.message).toContain("phone");

    const email = createTestEmail("register-company");
    const valid = await request(app).post("/auth/register").send({
      name: "Integration Hiring Admin",
      email,
      password: validPassword,
      role: "COMPANY_ADMIN",
      companyName: `${testMarker} Registered Company`,
      phone: "081234567890",
    });
    expect(valid.status).toBe(201);
    expect(valid.body.data.user.role).toBe("COMPANY_ADMIN");

    const company = await prisma.company.findFirst({
      where: { user: { email } },
    });
    expect(company).toMatchObject({
      companyName: `${testMarker} Registered Company`,
      phone: "081234567890",
    });
  });

  it("rejects duplicate email registration and invalid login credentials", async () => {
    const user = await createTestSeeker("duplicate");

    const duplicate = await request(app).post("/auth/register").send({
      name: "Duplicate User",
      email: user.email,
      password: validPassword,
      role: "JOB_SEEKER",
    });
    expect(duplicate.status).toBe(409);

    const invalidLogin = await request(app).post("/auth/login").send({
      email: user.email,
      password: "WrongPassword1!",
    });
    expect(invalidLogin.status).toBe(401);

    const validLogin = await request(app).post("/auth/login").send({
      email: user.email,
      password: validPassword,
    });
    expect(validLogin.status).toBe(200);
    expect(validLogin.body.data.user.id).toBe(user.id);
  });

  it("protects authenticated routes when a bearer token is missing", async () => {
    const response = await request(app).get("/auth/me");
    expect(response.status).toBe(401);
    expect(response.body.message).toContain("token missing");
  });

  it("verifies email only once and rejects an expired verification link", async () => {
    const rawToken = randomUUID().replaceAll("-", "");
    const user = await createTestSeeker("verify-once", {
      emailVerificationTokenHash: hashToken(rawToken),
      emailVerificationExpiresAt: new Date(Date.now() + 60 * 60 * 1000),
    });

    const first = await request(app)
      .post("/auth/verify-email")
      .send({ token: rawToken });
    expect(first.status).toBe(200);

    const stored = await prisma.user.findUniqueOrThrow({
      where: { id: user.id },
    });
    expect(stored.emailVerifiedAt).toBeInstanceOf(Date);
    expect(stored.emailVerificationTokenHash).toBeNull();

    const reused = await request(app)
      .post("/auth/verify-email")
      .send({ token: rawToken });
    expect(reused.status).toBe(400);

    const expiredToken = randomUUID().replaceAll("-", "");
    await createTestSeeker("expired-verification", {
      emailVerificationTokenHash: hashToken(expiredToken),
      emailVerificationExpiresAt: new Date(Date.now() - 1_000),
    });
    const expired = await request(app)
      .post("/auth/verify-email")
      .send({ token: expiredToken });
    expect(expired.status).toBe(400);
  });

  it("resets an email account password with a one-time token", async () => {
    const rawToken = randomUUID().replaceAll("-", "");
    const user = await createTestSeeker("password-reset", {
      passwordResetTokenHash: hashToken(rawToken),
      passwordResetExpiresAt: new Date(Date.now() + 60 * 60 * 1000),
    });
    const newPassword = "NewStrongPass2!";

    const reset = await request(app).post("/auth/reset-password").send({
      token: rawToken,
      password: newPassword,
    });
    expect(reset.status).toBe(200);

    const login = await request(app).post("/auth/login").send({
      email: user.email,
      password: newPassword,
    });
    expect(login.status).toBe(200);

    const reused = await request(app).post("/auth/reset-password").send({
      token: rawToken,
      password: "AnotherPass3!",
    });
    expect(reused.status).toBe(400);
  });

  it("does not issue password reset credentials for a social-login account", async () => {
    const user = await createTestSeeker("google-reset", {
      authProvider: "GOOGLE",
      password: null,
      emailVerifiedAt: new Date(),
    });

    const response = await request(app)
      .post("/auth/forgot-password")
      .send({ email: user.email });
    expect(response.status).toBe(200);

    const stored = await prisma.user.findUniqueOrThrow({
      where: { id: user.id },
    });
    expect(stored.passwordResetTokenHash).toBeNull();
    expect(stored.passwordResetExpiresAt).toBeNull();
  });

  it("blocks an unverified job seeker before creating a subscription payment", async () => {
    const user = await createTestSeeker("unverified-subscription");
    const response = await request(app)
      .post("/subscriptions/purchase")
      .set("Authorization", `Bearer ${createAuthToken(user)}`)
      .send({ plan: "STANDARD" });

    expect(response.status).toBe(403);
    expect(response.body.message).toContain("Verify your email");
  });
});
