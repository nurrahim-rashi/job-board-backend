import { afterEach, describe, expect, it } from "vitest";

import {
  cloudinaryConfig,
  isImageStorageConfigured,
  verifiedImage,
} from "../lib/cloudinary.js";

const keys = [
  "CLOUDINARY_URL",
  "CLOUDINARY_CLOUD_NAME",
  "CLOUDINARY_NAME",
  "CLOUDINARY_API_KEY",
  "CLOUDINARY_API_SECRET",
] as const;

const original = Object.fromEntries(keys.map((key) => [key, process.env[key]]));

function clearCloudinaryEnvironment() {
  keys.forEach((key) => delete process.env[key]);
}

afterEach(() => {
  clearCloudinaryEnvironment();
  keys.forEach((key) => {
    const value = original[key];
    if (value !== undefined) process.env[key] = value;
  });
});

describe("Cloudinary image storage", () => {
  it("reads the standard CLOUDINARY_URL used by hosting integrations", () => {
    clearCloudinaryEnvironment();
    process.env.CLOUDINARY_URL =
      "cloudinary://key-123:secret%3A456@polaris-media";

    expect(cloudinaryConfig()).toEqual({
      cloudName: "polaris-media",
      apiKey: "key-123",
      apiSecret: "secret:456",
    });
    expect(isImageStorageConfigured()).toBe(true);
  });

  it("does not treat placeholder values as configured credentials", () => {
    clearCloudinaryEnvironment();
    process.env.CLOUDINARY_CLOUD_NAME = "...";
    process.env.CLOUDINARY_API_KEY = "...";
    process.env.CLOUDINARY_API_SECRET = "...";

    expect(isImageStorageConfigured()).toBe(false);
  });

  it("checks image bytes instead of trusting the browser MIME type", () => {
    const file = {
      originalname: "avatar.txt",
      mimetype: "text/plain",
      buffer: Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    } as Express.Multer.File;

    expect(verifiedImage(file).mimetype).toBe("image/png");
    expect(() =>
      verifiedImage({ ...file, buffer: Buffer.from("not an image") }),
    ).toThrow("must be a valid JPG, PNG, WEBP, GIF, AVIF, or HEIC image");
  });
});
