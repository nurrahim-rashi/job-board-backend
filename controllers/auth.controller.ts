import type { Request, Response } from "express";
import { randomUUID } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { type AuthenticatedRequest } from "../middlewares/auth.middleware.js";
import { getHomepageData } from "../services/homepage.service.js";
import {
  changePassword,
  getAuthenticatedUser,
  getSubscriptionStatus,
  loginUser,
  registerUser,
  requestPasswordReset,
  resendVerificationEmail,
  resetPassword,
  updateProfile,
  updateAvatar,
  verifyEmail,
} from "../services/auth.service.js";

const userId = (req: Request) => (req as AuthenticatedRequest).user.id;

export async function registerController(req: Request, res: Response) {
  const session = await registerUser(req.body);
  return res.status(201).json({ message: "Account created. Verify your email to unlock protected features.", data: session });
}

export async function loginController(req: Request, res: Response) {
  const session = await loginUser(req.body);
  return res.status(200).json({ message: "Signed in successfully", data: session });
}

export async function meController(req: Request, res: Response) {
  return res.status(200).json({ data: await getAuthenticatedUser(userId(req)) });
}

export async function subscriptionStatusController(req: Request, res: Response) {
  return res.status(200).json({
    data: await getSubscriptionStatus(userId(req)),
  });
}

export async function homepageController(req: Request, res: Response) {
  return res.status(200).json({ data: await getHomepageData(userId(req)) });
}

export async function verifyEmailController(req: Request, res: Response) {
  await verifyEmail(req.body.token);
  return res.status(200).json({ message: "Email verified. Please sign in again." });
}

export async function resendVerificationController(req: Request, res: Response) {
  await resendVerificationEmail(req.body.email);
  return res.status(200).json({ message: "If the account needs verification, a new email has been sent." });
}

export async function forgotPasswordController(req: Request, res: Response) {
  await requestPasswordReset(req.body.email);
  return res.status(200).json({ message: "If this email uses password login, a reset link has been sent." });
}

export async function resetPasswordController(req: Request, res: Response) {
  await resetPassword(req.body.token, req.body.password);
  return res.status(200).json({ message: "Password reset successfully. Please sign in." });
}

export async function updateProfileController(req: Request, res: Response) {
  const user = await updateProfile(userId(req), req.body);
  return res.status(200).json({ message: "Profile updated successfully", data: user });
}

export async function changePasswordController(req: Request, res: Response) {
  await changePassword(userId(req), req.body.currentPassword, req.body.newPassword);
  return res.status(200).json({ message: "Password updated successfully" });
}

export async function uploadAvatarController(req: Request, res: Response) {
  const contentType = req.headers["content-type"]?.split(";")[0];
  const extensions: Record<string, string> = { "image/jpeg": ".jpg", "image/png": ".png" };
  if (!contentType || !extensions[contentType] || !Buffer.isBuffer(req.body)) {
    return res.status(400).json({ message: "Avatar must be a JPG, JPEG, or PNG file" });
  }
  if (req.body.length > 1024 * 1024) return res.status(400).json({ message: "Avatar must be 1MB or smaller" });
  const uploadPath = join(process.cwd(), "uploads", "avatars");
  const fileName = `${randomUUID()}${extensions[contentType]}`;
  await mkdir(uploadPath, { recursive: true });
  await writeFile(join(uploadPath, fileName), req.body);
  const user = await updateAvatar(userId(req), `/uploads/avatars/${fileName}`);
  return res.status(200).json({ message: "Avatar uploaded successfully", data: user });
}

export function logoutController(_req: Request, res: Response) {
  return res.status(204).send();
}
