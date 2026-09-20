import request from "supertest";
import { beforeEach, describe, expect, it, vi } from "vitest";

import app from "../app.js";
import { prisma } from "../lib/prisma.js";
import {
  createAuthToken,
  createTestCompany,
  createTestSeeker,
  setupApiIntegrationLifecycle,
} from "./helpers/api-integration.fixture.js";

const { uploadImageMock } = vi.hoisted(() => ({ uploadImageMock: vi.fn() }));

// `.env` holds working Cloudinary credentials, so the real helper would upload
// these fixtures to the live account. Only the transport is stubbed: the
// format and size checks in front of it still run for real.
vi.mock("../lib/cloudinary.js", async () => {
  const actual = await vi.importActual<typeof import("../lib/cloudinary.js")>(
    "../lib/cloudinary.js",
  );
  return { ...actual, uploadImage: uploadImageMock };
});

// A one pixel PNG, enough for the magic-number check to accept it.
const png = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
  "base64",
);

setupApiIntegrationLifecycle();

beforeEach(() => {
  uploadImageMock.mockReset();
  uploadImageMock.mockResolvedValue({
    secure_url: "https://cdn.example.test/company/logo.png",
  });
});

describe("Company logo and banner", () => {
  it("stores an uploaded logo against the admin's company", async () => {
    const { admin, company } = await createTestCompany("Media Logo");

    const response = await request(app)
      .put("/auth/company-media/logo")
      .set("Authorization", `Bearer ${createAuthToken(admin)}`)
      .attach("media", png, { filename: "logo.png", contentType: "image/png" });

    expect(response.status).toBe(200);
    expect(uploadImageMock).toHaveBeenCalledTimes(1);

    const stored = await prisma.company.findUniqueOrThrow({
      where: { id: company.id },
    });
    expect(stored.logo).toBe("https://cdn.example.test/company/logo.png");
  });

  it("stores a banner separately from the logo", async () => {
    const { admin, company } = await createTestCompany("Media Banner");
    uploadImageMock.mockResolvedValue({
      secure_url: "https://cdn.example.test/company/banner.png",
    });

    const response = await request(app)
      .put("/auth/company-media/banner")
      .set("Authorization", `Bearer ${createAuthToken(admin)}`)
      .attach("media", png, {
        filename: "banner.png",
        contentType: "image/png",
      });

    expect(response.status).toBe(200);

    const stored = await prisma.company.findUniqueOrThrow({
      where: { id: company.id },
    });
    expect(stored.banner).toBe("https://cdn.example.test/company/banner.png");
    expect(stored.logo).toBeNull();
  });

  it("clears the stored media on delete", async () => {
    const { admin, company } = await createTestCompany("Media Remove");
    await prisma.company.update({
      where: { id: company.id },
      data: { logo: "https://cdn.example.test/company/old.png" },
    });

    const response = await request(app)
      .delete("/auth/company-media/logo")
      .set("Authorization", `Bearer ${createAuthToken(admin)}`);

    expect(response.status).toBe(200);

    const stored = await prisma.company.findUniqueOrThrow({
      where: { id: company.id },
    });
    expect(stored.logo).toBeNull();
  });

  it("rejects a media field that is neither logo nor banner", async () => {
    const { admin } = await createTestCompany("Media Field");

    const response = await request(app)
      .put("/auth/company-media/mascot")
      .set("Authorization", `Bearer ${createAuthToken(admin)}`)
      .attach("media", png, { filename: "logo.png", contentType: "image/png" });

    expect(response.status).toBe(400);
    expect(uploadImageMock).not.toHaveBeenCalled();
  });

  it("rejects a file whose bytes are not an image, whatever the browser claims", async () => {
    const { admin } = await createTestCompany("Media Bytes");

    const response = await request(app)
      .put("/auth/company-media/logo")
      .set("Authorization", `Bearer ${createAuthToken(admin)}`)
      .attach("media", Buffer.from("%PDF-1.4 definitely not an image"), {
        filename: "logo.png",
        contentType: "image/png",
      });

    expect(response.status).toBe(400);
    expect(uploadImageMock).not.toHaveBeenCalled();
  });

  it("does not let a job seeker write company media", async () => {
    const user = await createTestSeeker("media-seeker", {
      emailVerifiedAt: new Date(),
    });

    const response = await request(app)
      .put("/auth/company-media/logo")
      .set("Authorization", `Bearer ${createAuthToken(user)}`)
      .attach("media", png, { filename: "logo.png", contentType: "image/png" });

    expect(response.status).toBe(403);
  });

  it("requires authentication", async () => {
    const response = await request(app).delete("/auth/company-media/logo");
    expect(response.status).toBe(401);
  });
});

describe("Profile photo limits", () => {
  it("rejects an avatar larger than the documented maximum", async () => {
    const user = await createTestSeeker("avatar-oversize");
    // Valid PNG header followed by padding, so the size check is what trips.
    const oversize = Buffer.concat([png, Buffer.alloc(4 * 1024 * 1024, 7)]);

    const response = await request(app)
      .put("/auth/avatar")
      .set("Authorization", `Bearer ${createAuthToken(user)}`)
      .attach("avatar", oversize, {
        filename: "avatar.png",
        contentType: "image/png",
      });

    expect(response.status).toBe(400);
    expect(uploadImageMock).not.toHaveBeenCalled();

    const stored = await prisma.user.findUniqueOrThrow({
      where: { id: user.id },
    });
    expect(stored.avatar).toBeNull();
  });

  it("accepts a small PNG and stores the returned URL", async () => {
    const user = await createTestSeeker("avatar-ok");
    uploadImageMock.mockResolvedValue({
      secure_url: "https://cdn.example.test/avatars/me.png",
    });

    const response = await request(app)
      .put("/auth/avatar")
      .set("Authorization", `Bearer ${createAuthToken(user)}`)
      .attach("avatar", png, {
        filename: "avatar.png",
        contentType: "image/png",
      });

    expect(response.status).toBe(200);

    const stored = await prisma.user.findUniqueOrThrow({
      where: { id: user.id },
    });
    expect(stored.avatar).toBe("https://cdn.example.test/avatars/me.png");
  });
});
