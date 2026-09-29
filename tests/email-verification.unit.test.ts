import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
const { user, sendEmail } = vi.hoisted(() => ({
  user: { findFirst: vi.fn(), findUnique: vi.fn(), updateMany: vi.fn(), update: vi.fn() },
  sendEmail: vi.fn(),
}));
vi.mock("../lib/prisma.js", () => ({ prisma: { user } }));
vi.mock("../services/email.service.js", () => ({ sendEmail }));
import { requestPasswordReset, resetPassword, resendVerificationByToken, validatePasswordResetLink, verifyEmail } from "../services/auth.service.js";
import { hashToken } from "../utils/token.js";
import { verifyPassword } from "../utils/password.js";
import express from "express";
import request from "supertest";
import { authRoutes } from "../routes/auth.routes.js";
import { errorHandler } from "../middlewares/error.middleware.js";

const app = express();
app.use(express.json(), authRoutes, errorHandler);
afterEach(() => vi.restoreAllMocks());

beforeEach(() => {
  vi.resetAllMocks();
  user.update.mockResolvedValue({});
  sendEmail.mockResolvedValue(undefined);
});

describe("Email verification", () => {
  it("distinguishes invalid and expired tokens without consuming expired tokens", async () => {
    user.findFirst.mockResolvedValue(null);
    await expect(verifyEmail("unknown")).rejects.toMatchObject({ code: "VERIFICATION_INVALID" });
    user.findFirst.mockResolvedValue({ id: 1, emailVerificationExpiresAt: new Date(Date.now() - 1000) });
    await expect(verifyEmail("expired")).rejects.toMatchObject({ code: "VERIFICATION_EXPIRED", message: expect.stringContaining("5 minutes") });
    expect(user.updateMany).not.toHaveBeenCalled();
  });

  it("consumes a valid token conditionally and rejects a concurrent reuse", async () => {
    user.findFirst.mockResolvedValue({ id: 1, emailVerificationExpiresAt: new Date(Date.now() + 60000) });
    user.updateMany.mockResolvedValueOnce({ count: 1 }).mockResolvedValueOnce({ count: 0 });
    await verifyEmail("valid");
    expect(user.updateMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({ id: 1, emailVerifiedAt: null, emailVerificationTokenHash: hashToken("valid") }),
      data: expect.objectContaining({ emailVerificationTokenHash: null, emailVerificationExpiresAt: null }),
    }));
    await expect(verifyEmail("valid")).rejects.toMatchObject({ code: "VERIFICATION_INVALID" });
  });

  it("replaces an expired token with a hashed five-minute token and emails the account", async () => {
    user.findFirst.mockResolvedValue({ id: 1, email: "person@example.test", emailVerificationExpiresAt: new Date(Date.now() - 1000) });
    const before = Date.now();
    await resendVerificationByToken("expired");
    const data = user.update.mock.calls[0][0].data;
    expect(data.emailVerificationExpiresAt.getTime()).toBeGreaterThanOrEqual(before + 300000);
    expect(data.emailVerificationExpiresAt.getTime()).toBeLessThanOrEqual(Date.now() + 300000);
    const mail = sendEmail.mock.calls[0][0];
    expect(mail.to).toBe("person@example.test");
    expect(mail.text).toContain("five minutes");
    const token = new URL(mail.text.split(" ").at(-1)).searchParams.get("token")!;
    expect(data.emailVerificationTokenHash).toBe(hashToken(token));
    expect(data.emailVerificationTokenHash).not.toBe(token);
  });

  it("does not resend for an unknown token", async () => {
    user.findFirst.mockResolvedValue(null);
    await expect(resendVerificationByToken("unknown")).rejects.toMatchObject({ code: "VERIFICATION_INVALID" });
    expect(sendEmail).not.toHaveBeenCalled();
  });
});


describe("Link expiry during verification", () => {
  it("reports expired when verification crosses the expiry boundary", async () => {
    user.findFirst
      .mockResolvedValueOnce({ id: 1, emailVerificationExpiresAt: new Date(Date.now() + 60000) })
      .mockResolvedValueOnce({ id: 1, emailVerificationExpiresAt: new Date(Date.now() - 1) });
    user.updateMany.mockResolvedValue({ count: 0 });
    await expect(verifyEmail("boundary")).rejects.toMatchObject({ code: "VERIFICATION_EXPIRED" });
  });

  it("reports invalid for a replaced verification token even if it has since expired", async () => {
    user.findFirst
      .mockResolvedValueOnce({ id: 1, emailVerificationExpiresAt: new Date(Date.now() + 60000) })
      .mockResolvedValueOnce(null);
    user.updateMany.mockResolvedValue({ count: 0 });
    await expect(verifyEmail("replaced")).rejects.toMatchObject({ code: "VERIFICATION_INVALID" });
  });
});

describe("Password reset links", () => {
  it("distinguishes unknown tokens from stored expired tokens without changing passwords", async () => {
    user.findFirst.mockResolvedValue(null);
    await expect(resetPassword("unknown", "StrongPass1!")).rejects.toMatchObject({ code: "PASSWORD_RESET_INVALID" });
    user.findFirst.mockResolvedValue({ id: 1, passwordResetExpiresAt: new Date(Date.now() - 1000) });
    await expect(resetPassword("expired", "StrongPass1!")).rejects.toMatchObject({ code: "PASSWORD_RESET_EXPIRED", message: expect.stringContaining("60 minutes") });
    expect(user.updateMany).not.toHaveBeenCalled();
  });

  it("treats missing expiry as invalid", async () => {
    user.findFirst.mockResolvedValue({ id: 1, passwordResetExpiresAt: null });
    await expect(validatePasswordResetLink("incomplete")).rejects.toMatchObject({ code: "PASSWORD_RESET_INVALID" });
  });

  it("checks valid links without consuming them", async () => {
    user.findFirst.mockResolvedValue({ id: 1, passwordResetExpiresAt: new Date(Date.now() + 60000) });
    await validatePasswordResetLink("valid");
    expect(user.updateMany).not.toHaveBeenCalled();
    expect(user.update).not.toHaveBeenCalled();
  });

  it("hashes the password and consumes the matching active token conditionally", async () => {
    user.findFirst.mockResolvedValue({ id: 1, passwordResetExpiresAt: new Date(Date.now() + 60000) });
    user.updateMany.mockResolvedValue({ count: 1 });
    await resetPassword("valid", "StrongPass1!");
    const { where, data } = user.updateMany.mock.calls[0][0];
    expect(where).toMatchObject({ id: 1, authProvider: "EMAIL", passwordResetTokenHash: hashToken("valid"), passwordResetExpiresAt: { gt: expect.any(Date) } });
    expect(data).toMatchObject({ passwordResetTokenHash: null, passwordResetExpiresAt: null });
    expect(await verifyPassword("StrongPass1!", data.password)).toBe(true);
    user.findFirst.mockResolvedValue(null);
    await expect(resetPassword("valid", "OtherPass2!")).rejects.toMatchObject({ code: "PASSWORD_RESET_INVALID" });
    expect(user.updateMany).toHaveBeenCalledTimes(1);
  });

  it("reports expired when the token expires during password hashing", async () => {
    user.findFirst
      .mockResolvedValueOnce({ id: 1, passwordResetExpiresAt: new Date(Date.now() + 60000) })
      .mockResolvedValueOnce({ id: 1, passwordResetExpiresAt: new Date(Date.now() - 1) });
    user.updateMany.mockResolvedValue({ count: 0 });
    await expect(resetPassword("boundary", "StrongPass1!")).rejects.toMatchObject({ code: "PASSWORD_RESET_EXPIRED" });
  });

  it("reports invalid when a concurrent request consumes or replaces the token", async () => {
    user.findFirst
      .mockResolvedValueOnce({ id: 1, passwordResetExpiresAt: new Date(Date.now() + 60000) })
      .mockResolvedValueOnce(null);
    user.updateMany.mockResolvedValue({ count: 0 });
    await expect(resetPassword("replaced", "StrongPass1!")).rejects.toMatchObject({ code: "PASSWORD_RESET_INVALID" });
  });

  it("matches the reset email lifetime to the database expiry", async () => {
    user.findUnique.mockResolvedValue({ id: 1, email: "person@example.test", authProvider: "EMAIL" });
    const before = Date.now();
    await requestPasswordReset("person@example.test");
    const data = user.update.mock.calls[0][0].data;
    expect(data.passwordResetExpiresAt.getTime()).toBeGreaterThanOrEqual(before + 3600000);
    expect(data.passwordResetExpiresAt.getTime()).toBeLessThanOrEqual(Date.now() + 3600000);
    expect(sendEmail.mock.calls[0][0].text).toContain("60 minutes");
    expect(sendEmail.mock.calls[0][0].html).toContain("60 minutes");
  });
});

describe("Email link API errors", () => {
  it.each([
    ["/verify-email", "VERIFICATION"],
    ["/reset-password/validate", "PASSWORD_RESET"],
    ["/reset-password", "PASSWORD_RESET"],
  ])("returns distinct error codes from %s", async (path, prefix) => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    for (const token of [undefined, "short", "x".repeat(32)]) {
      user.findFirst.mockResolvedValue(null);
      const response = await request(app).post(path).send({ token, password: "StrongPass1!" });
      expect(response.status).toBe(400);
      expect(response.body.code).toBe(`${prefix}_INVALID`);
      expect(response.body.message).toContain("invalid");
      expect(response.body.message).not.toContain("expired");
    }
    user.findFirst.mockResolvedValue({ id: 1, emailVerificationExpiresAt: new Date(0), passwordResetExpiresAt: new Date(0) });
    const expired = await request(app).post(path).send({ token: "x".repeat(32), password: "StrongPass1!" });
    expect(expired.status).toBe(400);
    expect(expired.body.code).toBe(`${prefix}_EXPIRED`);
    expect(expired.body.message).toContain("expired");
    expect(expired.body.message).not.toContain("invalid");
  });
});
