import axios from "axios";
import crypto from "crypto";
import FormData from "form-data";
import multer from "multer";
import { ApiError } from "../utils/api-error.js";
import { randomUUID } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";

type CloudinaryConfig = {
  cloudName?: string;
  apiKey?: string;
  apiSecret?: string;
};

const cleanEnv = (value?: string) => {
  const cleaned = value?.trim().replace(/^(['"])(.*)\1$/, "$2");
  if (!cleaned || ["...", "undefined", "null"].includes(cleaned.toLowerCase()))
    return undefined;
  return cleaned;
};

const configFromUrl = (value?: string): CloudinaryConfig => {
  const configuredUrl = cleanEnv(value);
  if (!configuredUrl) return {};
  try {
    const parsed = new URL(configuredUrl);
    if (parsed.protocol !== "cloudinary:") return {};
    return {
      cloudName: cleanEnv(decodeURIComponent(parsed.hostname)),
      apiKey: cleanEnv(decodeURIComponent(parsed.username)),
      apiSecret: cleanEnv(decodeURIComponent(parsed.password)),
    };
  } catch {
    return {};
  }
};

export const cloudinaryConfig = (): CloudinaryConfig => {
  const urlConfig = configFromUrl(process.env.CLOUDINARY_URL);
  return {
    cloudName:
      cleanEnv(process.env.CLOUDINARY_CLOUD_NAME) ??
      cleanEnv(process.env.CLOUDINARY_NAME) ??
      urlConfig.cloudName,
    apiKey: cleanEnv(process.env.CLOUDINARY_API_KEY) ?? urlConfig.apiKey,
    apiSecret:
      cleanEnv(process.env.CLOUDINARY_API_SECRET) ?? urlConfig.apiSecret,
  };
};

export const isImageStorageConfigured = () => {
  const { cloudName, apiKey, apiSecret } = cloudinaryConfig();
  return Boolean(cloudName && apiKey && apiSecret);
};

const imageMime = (bytes: Buffer) => {
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff)
    return "image/jpeg";
  if (
    bytes.length >= 8 &&
    bytes.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))
  ) return "image/png";
  if (
    bytes.length >= 12 &&
    bytes.subarray(0, 4).toString("ascii") === "RIFF" &&
    bytes.subarray(8, 12).toString("ascii") === "WEBP"
  ) return "image/webp";
  if (
    bytes.length >= 6 &&
    ["GIF87a", "GIF89a"].includes(bytes.subarray(0, 6).toString("ascii"))
  ) return "image/gif";
  if (bytes.length >= 12 && bytes.subarray(4, 8).toString("ascii") === "ftyp") {
    const brand = bytes.subarray(8, 12).toString("ascii").toLocaleLowerCase("en");
    if (["avif", "avis"].includes(brand)) return "image/avif";
    if (["heic", "heix", "hevc", "hevx", "mif1", "msf1"].includes(brand))
      return "image/heic";
  }
  return null;
};

const extensionForMime = (mimetype: string) =>
  ({
    "image/jpeg": ".jpg",
    "image/png": ".png",
    "image/webp": ".webp",
    "image/gif": ".gif",
    "image/avif": ".avif",
    "image/heic": ".heic",
  })[mimetype] ?? ".jpg";

export const verifiedImage = (file: Express.Multer.File, label = "Image") => {
  const mimetype = imageMime(file.buffer);
  if (!mimetype)
    throw new ApiError(
      `${label} must be a valid JPG, PNG, WEBP, GIF, AVIF, or HEIC image`,
      400,
    );
  return { ...file, mimetype };
};

/**
 * Generate Cloudinary signature (SHA1)
 */
const generateSignature = (params: Record<string, string | number>, apiSecret: string): string => {
  const sortedParams = Object.keys(params)
    .sort()
    .map((key) => `${key}=${params[key]}`)
    .join("&");

  return crypto
    .createHash("sha1")
    .update(sortedParams + apiSecret)
    .digest("hex");
};

/**
 * Upload image using SIGNED request
 */
export const uploadImage = async (
  file: Express.Multer.File,
  folder = "job-banners",
) => {
  const checked = verifiedImage(file);
  const safeFolder = folder.replace(/[^a-z0-9/_-]/gi, "-");
  const { cloudName, apiKey, apiSecret } = cloudinaryConfig();
  if (!cloudName || !apiKey || !apiSecret) {
    if (process.env.NODE_ENV === "production")
      throw new ApiError(
        "Image storage is not configured. Set CLOUDINARY_URL or the CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, and CLOUDINARY_API_SECRET variables.",
        503,
      );
    const extension = extensionForMime(checked.mimetype);
    const uploadPath = join(process.cwd(), "uploads", safeFolder);
    const fileName = `${randomUUID()}${extension}`;
    await mkdir(uploadPath, { recursive: true });
    await writeFile(join(uploadPath, fileName), checked.buffer);
    return { secure_url: `/uploads/${safeFolder}/${fileName}` };
  }
  const timestamp = Math.floor(Date.now() / 1000);

  const signature = generateSignature({ folder: safeFolder, timestamp }, apiSecret);

  const formData = new FormData();

  formData.append("file", checked.buffer, {
    filename: checked.originalname,
    contentType: checked.mimetype,
  });

  formData.append("api_key", apiKey);
  formData.append("folder", safeFolder);
  formData.append("timestamp", timestamp.toString());
  formData.append("signature", signature);

  try {
    const response = await axios.post(
      `https://api.cloudinary.com/v1_1/${cloudName}/image/upload`,
      formData,
      { headers: formData.getHeaders(), timeout: 30_000 },
    );
    return response.data;
  } catch (error) {
    if (axios.isAxiosError(error)) {
      console.error("Cloudinary upload failed", error.response?.status, error.response?.data);
      throw new ApiError(
        error.response?.status === 401 ? "Image storage credentials are invalid" : "Image upload provider rejected the file",
        502,
      );
    }
    throw error;
  }
};

/**
 * Extract public_id from secure_url
 */
const extractPublicIdFromUrl = (url: string): string => {
  const withoutQuery = url.split("?")[0] ?? url;
  const parts = withoutQuery.split("/");

  const uploadIndex = parts.findIndex((part) => part === "upload");
  if (uploadIndex === -1) {
    throw new ApiError("Invalid Cloudinary URL", 400);
  }

  const publicIdParts = parts.slice(uploadIndex + 2);

  return publicIdParts.join("/").replace(/\.[^/.]+$/, "");
};

/**
 * Delete image by secure_url
 */
export const removeImageByUrl = async (secureUrl: string) => {
  const { cloudName, apiKey, apiSecret } = cloudinaryConfig();
  if (!cloudName || !apiKey || !apiSecret)
    throw new ApiError("Image storage is not configured", 503);
  const publicId = extractPublicIdFromUrl(secureUrl);
  const timestamp = Math.floor(Date.now() / 1000);

  const signature = generateSignature({
    public_id: publicId,
    timestamp,
  }, apiSecret);

  const formData = new FormData();

  formData.append("public_id", publicId);
  formData.append("api_key", apiKey);
  formData.append("timestamp", timestamp.toString());
  formData.append("signature", signature);

  const response = await axios.post(
    `https://api.cloudinary.com/v1_1/${cloudName}/image/destroy`,
    formData,
    {
      headers: formData.getHeaders(),
    },
  );

  return response.data;
};
