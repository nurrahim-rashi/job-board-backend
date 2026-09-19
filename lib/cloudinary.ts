import axios from "axios";
import crypto from "crypto";
import FormData from "form-data";
import multer from "multer";
import { ApiError } from "../utils/api-error.js";
import { randomUUID } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import { extname, join } from "node:path";

const cloudinaryConfig = () => ({
  cloudName: process.env.CLOUDINARY_CLOUD_NAME?.trim(),
  apiKey: process.env.CLOUDINARY_API_KEY?.trim(),
  apiSecret: process.env.CLOUDINARY_API_SECRET?.trim(),
});

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
  const safeFolder = folder.replace(/[^a-z0-9/_-]/gi, "-");
  const { cloudName, apiKey, apiSecret } = cloudinaryConfig();
  if (!cloudName || !apiKey || !apiSecret) {
    if (process.env.NODE_ENV === "production")
      throw new ApiError("Image storage is not configured", 503);
    const extension = extname(file.originalname).toLowerCase() ||
      (file.mimetype === "image/png" ? ".png" : ".jpg");
    const uploadPath = join(process.cwd(), "uploads", safeFolder);
    const fileName = `${randomUUID()}${extension}`;
    await mkdir(uploadPath, { recursive: true });
    await writeFile(join(uploadPath, fileName), file.buffer);
    return { secure_url: `/uploads/${safeFolder}/${fileName}` };
  }
  const timestamp = Math.floor(Date.now() / 1000);

  const signature = generateSignature({ folder: safeFolder, timestamp }, apiSecret);

  const formData = new FormData();

  formData.append("file", file.buffer, {
    filename: file.originalname,
    contentType: file.mimetype,
  });

  formData.append("api_key", apiKey);
  formData.append("folder", safeFolder);
  formData.append("timestamp", timestamp.toString());
  formData.append("signature", signature);

  try {
    const response = await axios.post(
      `https://api.cloudinary.com/v1_1/${cloudName}/image/upload`,
      formData,
      { headers: formData.getHeaders(), timeout: 15_000 },
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
