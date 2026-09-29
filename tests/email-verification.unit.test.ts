import { beforeEach, describe, expect, it, vi } from "vitest";
const { user, sendEmail } = vi.hoisted(() => ({
  user: { findFirst: vi.fn(), updateMany: vi.fn(), update: vi.fn() },
  sendEmail: vi.fn(),
}));
vi.mock("../lib/prisma.js", () => ({ prisma: { user } }));
vi.mock("../services/email.service.js", () => ({ sendEmail }));
import { resendVerificationByToken, verifyEmail } from "../services/auth.service.js";
import { hashToken } from "../utils/token.js";

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
