import request from "supertest";
import { beforeEach, describe, expect, it, vi } from "vitest";

import app from "../app.js";
import { prisma } from "../lib/prisma.js";
import {
  createTestEmail,
  createTestSeeker,
  setupApiIntegrationLifecycle,
} from "./helpers/api-integration.fixture.js";

const { verifyIdTokenMock } = vi.hoisted(() => ({
  verifyIdTokenMock: vi.fn(),
}));

// The real client would call Google over the network and reject every token we
// could construct here, so the signature check is the one thing we stub out.
vi.mock("google-auth-library", () => ({
  OAuth2Client: class {
    verifyIdToken = verifyIdTokenMock;
  },
}));

const googlePayload = (payload: Record<string, unknown>) => ({
  getPayload: () => payload,
});
const validGoogleCredential = "mock-google-id-token-credential";

setupApiIntegrationLifecycle();

beforeEach(() => {
  verifyIdTokenMock.mockReset();
  process.env.GOOGLE_CLIENT_ID ??= "test-google-client-id";
});

describe("Google sign-in", () => {
  it("registers a new job seeker from a verified Google account", async () => {
    const email = createTestEmail("google-new");
    verifyIdTokenMock.mockResolvedValue(
      googlePayload({
        email,
        email_verified: true,
        name: "Google Newcomer",
        picture: "https://example.test/avatar.png",
      }),
    );

    const response = await request(app)
      .post("/auth/google")
      .send({ credential: validGoogleCredential });

    expect(response.status).toBe(200);
    expect(response.body.data.token).toBeTruthy();
    expect(response.body.data.user).toMatchObject({
      email,
      name: "Google Newcomer",
      role: "JOB_SEEKER",
    });

    const stored = await prisma.user.findUniqueOrThrow({ where: { email } });
    expect(stored.authProvider).toBe("GOOGLE");
    expect(stored.password).toBeNull();
    // A Google account arrives already verified, so it never needs the emailed
    // verification link that password accounts do.
    expect(stored.emailVerifiedAt).not.toBeNull();
  });

  it("signs an existing Google account back in and refreshes its profile", async () => {
    const user = await createTestSeeker("google-existing", {
      password: null,
      authProvider: "GOOGLE",
      emailVerifiedAt: new Date(),
    });
    verifyIdTokenMock.mockResolvedValue(
      googlePayload({
        email: user.email,
        email_verified: true,
        name: "Renamed On Google",
        picture: "https://example.test/new-avatar.png",
      }),
    );

    const response = await request(app)
      .post("/auth/google")
      .send({ credential: validGoogleCredential });

    expect(response.status).toBe(200);
    expect(response.body.data.user.id).toBe(user.id);
    expect(response.body.data.user.name).toBe("Renamed On Google");

    const count = await prisma.user.count({ where: { email: user.email } });
    expect(count).toBe(1);
  });

  it("refuses a Google credential for an email that already uses a password", async () => {
    const user = await createTestSeeker("google-conflict", {
      emailVerifiedAt: new Date(),
    });
    verifyIdTokenMock.mockResolvedValue(
      googlePayload({
        email: user.email,
        email_verified: true,
        name: "Password Account",
      }),
    );

    const response = await request(app)
      .post("/auth/google")
      .send({ credential: validGoogleCredential });

    expect(response.status).toBe(409);
    expect(response.body.message).toContain("password login");

    const stored = await prisma.user.findUniqueOrThrow({
      where: { id: user.id },
    });
    expect(stored.authProvider).toBe("EMAIL");
  });

  it("rejects a Google account whose email is not verified", async () => {
    verifyIdTokenMock.mockResolvedValue(
      googlePayload({
        email: createTestEmail("google-unverified"),
        email_verified: false,
        name: "Unverified Google",
      }),
    );

    const response = await request(app)
      .post("/auth/google")
      .send({ credential: validGoogleCredential });

    expect(response.status).toBe(401);
  });

  it("rejects a credential Google cannot validate", async () => {
    verifyIdTokenMock.mockRejectedValue(new Error("invalid token"));

    const response = await request(app)
      .post("/auth/google")
      .send({ credential: "tampered-google-id-token-credential" });

    expect(response.status).toBe(401);
    expect(response.body.message).toContain("invalid or has expired");
  });
});
