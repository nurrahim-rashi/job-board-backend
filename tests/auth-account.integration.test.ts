import request from "supertest";
import { beforeEach, describe, expect, it, vi } from "vitest";

import app from "../app.js";
import { prisma } from "../lib/prisma.js";
import { verifyPassword } from "../utils/password.js";
import {
  createAuthToken,
  createTestEmail,
  createTestSeeker,
  setupApiIntegrationLifecycle,
  validPassword,
} from "./helpers/api-integration.fixture.js";

const { sendEmailMock } = vi.hoisted(() => ({ sendEmailMock: vi.fn() }));

// `.env` carries a live RESEND_API_KEY and NODE_ENV=production, and both leak
// into the test run through `import "dotenv/config"`. Without this mock these
// tests would post real mail to Resend.
vi.mock("../services/email.service.js", () => ({
  sendEmail: sendEmailMock,
}));

setupApiIntegrationLifecycle();

beforeEach(() => {
  sendEmailMock.mockReset();
  sendEmailMock.mockResolvedValue(undefined);
});

describe("Resending the verification email", () => {
  it("issues a fresh one-hour token for an unverified account", async () => {
    const user = await createTestSeeker("resend-unverified", {
      emailVerificationTokenHash: "stale-hash",
      emailVerificationExpiresAt: new Date(Date.now() - 60 * 60 * 1000),
    });
    const before = Date.now();

    const response = await request(app)
      .post("/auth/resend-verification")
      .send({ email: user.email });

    expect(response.status).toBe(200);
    expect(sendEmailMock).toHaveBeenCalledTimes(1);
    expect(sendEmailMock.mock.calls[0]?.[0]).toMatchObject({ to: user.email });

    const stored = await prisma.user.findUniqueOrThrow({
      where: { id: user.id },
    });
    expect(stored.emailVerificationTokenHash).not.toBe("stale-hash");
    expect(stored.emailVerificationTokenHash).toBeTruthy();
    const expiresAt = stored.emailVerificationExpiresAt?.getTime() ?? 0;
    expect(expiresAt).toBeGreaterThan(before + 55 * 60 * 1000);
    expect(expiresAt).toBeLessThanOrEqual(Date.now() + 60 * 60 * 1000);
  });

  it("refuses to resend once the account is already verified", async () => {
    const user = await createTestSeeker("resend-verified", {
      emailVerifiedAt: new Date(),
    });

    const response = await request(app)
      .post("/auth/resend-verification")
      .send({ email: user.email });

    expect(response.status).toBe(400);
    expect(response.body.message).toContain("already verified");
    expect(sendEmailMock).not.toHaveBeenCalled();
  });

  it("does not disclose whether an unknown address has an account", async () => {
    const response = await request(app)
      .post("/auth/resend-verification")
      .send({ email: createTestEmail("resend-unknown") });

    expect(response.status).toBe(200);
    expect(sendEmailMock).not.toHaveBeenCalled();
  });
});

describe("Changing the password from the profile", () => {
  const newPassword = "EvenStronger2!";

  it("replaces the password and accepts the new one at login", async () => {
    const user = await createTestSeeker("change-password", {
      emailVerifiedAt: new Date(),
    });

    const response = await request(app)
      .post("/auth/change-password")
      .set("Authorization", `Bearer ${createAuthToken(user)}`)
      .send({ currentPassword: validPassword, newPassword });

    expect(response.status).toBe(200);

    const stored = await prisma.user.findUniqueOrThrow({
      where: { id: user.id },
    });
    expect(stored.password).not.toBe(user.password);
    await expect(verifyPassword(newPassword, stored.password!)).resolves.toBe(
      true,
    );

    const login = await request(app)
      .post("/auth/login")
      .send({ email: user.email, password: newPassword });
    expect(login.status).toBe(200);

    const oldLogin = await request(app)
      .post("/auth/login")
      .send({ email: user.email, password: validPassword });
    expect(oldLogin.status).toBe(401);
  });

  it("rejects a wrong current password and leaves the stored one alone", async () => {
    const user = await createTestSeeker("change-password-wrong", {
      emailVerifiedAt: new Date(),
    });

    const response = await request(app)
      .post("/auth/change-password")
      .set("Authorization", `Bearer ${createAuthToken(user)}`)
      .send({ currentPassword: "NotMyPassword9!", newPassword });

    expect(response.status).toBe(400);
    expect(response.body.message).toContain("Current password is incorrect");

    const stored = await prisma.user.findUniqueOrThrow({
      where: { id: user.id },
    });
    expect(stored.password).toBe(user.password);
  });

  it("rejects a new password that fails the strength rules", async () => {
    const user = await createTestSeeker("change-password-weak", {
      emailVerifiedAt: new Date(),
    });

    const response = await request(app)
      .post("/auth/change-password")
      .set("Authorization", `Bearer ${createAuthToken(user)}`)
      .send({ currentPassword: validPassword, newPassword: "alllowercase" });

    expect(response.status).toBe(400);

    const stored = await prisma.user.findUniqueOrThrow({
      where: { id: user.id },
    });
    expect(stored.password).toBe(user.password);
  });

  it("refuses for a social-login account, which has no password to replace", async () => {
    const user = await createTestSeeker("change-password-google", {
      password: null,
      authProvider: "GOOGLE",
      emailVerifiedAt: new Date(),
    });

    const response = await request(app)
      .post("/auth/change-password")
      .set("Authorization", `Bearer ${createAuthToken(user)}`)
      .send({ currentPassword: validPassword, newPassword });

    expect(response.status).toBe(400);
    expect(response.body.message).toContain("social login provider");
  });

  it("requires authentication", async () => {
    const response = await request(app)
      .post("/auth/change-password")
      .send({ currentPassword: validPassword, newPassword });

    expect(response.status).toBe(401);
  });
});

describe("Applicant age limit", () => {
  const isoYearsAgo = (years: number, dayShift = 0) => {
    const date = new Date();
    date.setFullYear(date.getFullYear() - years);
    date.setDate(date.getDate() + dayShift);

    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");

    return `${year}-${month}-${day}`;
  };

  it("accepts an applicant who turns 17 today", async () => {
    const user = await createTestSeeker("age-exactly-17", {
      emailVerifiedAt: new Date(),
    });

    const response = await request(app)
      .patch("/auth/profile")
      .set("Authorization", `Bearer ${createAuthToken(user)}`)
      .send({ birthDate: isoYearsAgo(17) });

    expect(response.status).toBe(200);
  });

  it("rejects an applicant who is still 16 for one more day", async () => {
    const user = await createTestSeeker("age-16", {
      emailVerifiedAt: new Date(),
    });

    const response = await request(app)
      .patch("/auth/profile")
      .set("Authorization", `Bearer ${createAuthToken(user)}`)
      .send({ birthDate: isoYearsAgo(17, 1) });

    expect(response.status).toBe(400);

    const stored = await prisma.user.findUniqueOrThrow({
      where: { id: user.id },
    });
    expect(stored.birthDate).toBeNull();
  });

  it("rejects a birth date in the future", async () => {
    const user = await createTestSeeker("age-future", {
      emailVerifiedAt: new Date(),
    });

    const response = await request(app)
      .patch("/auth/profile")
      .set("Authorization", `Bearer ${createAuthToken(user)}`)
      .send({ birthDate: isoYearsAgo(-1) });

    expect(response.status).toBe(400);
  });
});
