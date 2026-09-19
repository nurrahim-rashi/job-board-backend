import type { Request, Response } from "express";
import { type AuthenticatedRequest } from "../middlewares/auth.middleware.js";
import { uploadImage } from "../lib/cloudinary.js";
import { getHomepageData } from "../services/homepage.service.js";
import { ApiError } from "../utils/api-error.js";
import {
  changePassword,
  getAuthenticatedUser,
  getSubscriptionStatus,
  loginUser,
  loginWithGoogle,
  registerUser,
  requestPasswordReset,
  resendVerificationEmail,
  resetPassword,
  updateProfile,
  updateAvatar,
  updateCompanyMedia,
  verifyEmail,
} from "../services/auth.service.js";

const userId = (req: Request) => (req as AuthenticatedRequest).user.id;

function imageMime(file: Express.Multer.File) {
  const bytes = file.buffer;
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
    (bytes.subarray(0, 6).toString("ascii") === "GIF87a" ||
      bytes.subarray(0, 6).toString("ascii") === "GIF89a")
  ) return "image/gif";
  if (bytes.length >= 12 && bytes.subarray(4, 8).toString("ascii") === "ftyp") {
    const brand = bytes.subarray(8, 12).toString("ascii").toLocaleLowerCase("en");
    if (brand === "avif" || brand === "avis") return "image/avif";
    if (["heic", "heix", "hevc", "hevx", "mif1", "msf1"].includes(brand))
      return "image/heic";
  }
  return null;
}

function verifiedImage(file: Express.Multer.File, label: string) {
  const mimetype = imageMime(file);
  if (!mimetype)
    throw new ApiError(`${label} must be a valid JPG, PNG, WEBP, GIF, AVIF, or HEIC image`, 400);
  return { ...file, mimetype };
}

export async function registerController(req: Request, res: Response) {
  const session = await registerUser(req.body);
  return res.status(201).json({
    message: "Account created. Verify your email to unlock protected features.",
    data: session,
  });
}

export async function loginController(req: Request, res: Response) {
  const session = await loginUser(req.body);
  return res
    .status(200)
    .json({ message: "Signed in successfully", data: session });
}

export async function googleLoginController(req: Request, res: Response) {
  const session = await loginWithGoogle(req.body.credential);
  return res
    .status(200)
    .json({ message: "Signed in with Google", data: session });
}

export async function meController(req: Request, res: Response) {
  return res
    .status(200)
    .json({ data: await getAuthenticatedUser(userId(req)) });
}

export async function subscriptionStatusController(
  req: Request,
  res: Response,
) {
  return res.status(200).json({
    data: await getSubscriptionStatus(userId(req)),
  });
}

export async function homepageController(req: Request, res: Response) {
  return res.status(200).json({ data: await getHomepageData(userId(req)) });
}

export async function verifyEmailController(req: Request, res: Response) {
  await verifyEmail(req.body.token);
  return res
    .status(200)
    .json({ message: "Email verified. Please sign in again." });
}

export async function resendVerificationController(
  req: Request,
  res: Response,
) {
  await resendVerificationEmail(req.body.email);
  return res.status(200).json({
    message: "If the account needs verification, a new email has been sent.",
  });
}

export async function forgotPasswordController(req: Request, res: Response) {
  await requestPasswordReset(req.body.email);
  return res.status(200).json({
    message: "If this email uses password login, a reset link has been sent.",
  });
}

export async function resetPasswordController(req: Request, res: Response) {
  await resetPassword(req.body.token, req.body.password);
  return res
    .status(200)
    .json({ message: "Password reset successfully. Please sign in." });
}

export async function updateProfileController(req: Request, res: Response) {
  const user = await updateProfile(userId(req), req.body);
  return res
    .status(200)
    .json({ message: "Profile updated successfully", data: user });
}

export async function changePasswordController(req: Request, res: Response) {
  await changePassword(
    userId(req),
    req.body.currentPassword,
    req.body.newPassword,
  );
  return res.status(200).json({ message: "Password updated successfully" });
}

export async function uploadAvatarController(req: Request, res: Response) {
  const file = (req as any).file;
  if (!file) {
    if (!String(req.headers["content-type"] ?? "").startsWith("multipart/form-data")) {
      return res.status(400).json({ message: "Upload the avatar as multipart form data using the avatar field" });
    }
    return res.status(400).json({ message: "Avatar file is required" });
  }

  if (file.size > 3 * 1024 * 1024) {
    return res.status(400).json({ message: "Avatar must be 3MB or smaller" });
  }
  const checked = verifiedImage(file, "Avatar");
  const avatarUrl = (await uploadImage(checked, "avatars")).secure_url;

  const user = await updateAvatar(userId(req), avatarUrl);
  return res
    .status(200)
    .json({ message: "Avatar uploaded successfully", data: user });
}

export async function removeAvatarController(req: Request, res: Response) {
  const user = await updateAvatar(userId(req), null);
  return res.status(200).json({ message: "Profile photo removed", data: user });
}

export async function uploadCompanyMediaController(
  req: Request,
  res: Response,
) {
  const field = req.params.field;
  if (field !== "logo" && field !== "banner") {
    return res.status(400).json({ message: "Company media type is invalid" });
  }

  const file = (req as any).file;
  if (!file) {
    return res.status(400).json({ message: "Image file is required" });
  }

  if (file.size > 4 * 1024 * 1024) {
    return res.status(400).json({ message: "Image must be 4MB or smaller" });
  }
  const checked = verifiedImage(file, "Company media");
  const mediaUrl = (await uploadImage(checked, `companies/${field}`)).secure_url;

  const user = await updateCompanyMedia(userId(req), field, mediaUrl);
  return res
    .status(200)
    .json({ message: `Company ${field} uploaded`, data: user });
}

export async function removeCompanyMediaController(
  req: Request,
  res: Response,
) {
  const field = req.params.field;
  if (field !== "logo" && field !== "banner")
    return res.status(400).json({ message: "Company media type is invalid" });
  const user = await updateCompanyMedia(userId(req), field, null);
  return res
    .status(200)
    .json({ message: `Company ${field} removed`, data: user });
}

export function logoutController(_req: Request, res: Response) {
  return res.status(204).send();
}
