import type { Request, Response } from "express";
import { type AuthenticatedRequest } from "../middlewares/auth.middleware.js";
import { uploadImage } from "../lib/cloudinary.js";
import { getHomepageData } from "../services/homepage.service.js";
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
      return res.status(400).json({ message: "Avatar must be a JPG, JPEG, or PNG image (WEBP is also supported)" });
    }
    return res.status(400).json({ message: "Avatar file is required" });
  }

  if (file.size > 1024 * 1024) {
    return res.status(400).json({ message: "Avatar must be 1MB or smaller" });
  }
  if (!/^image\/(jpeg|png|webp)$/.test(file.mimetype)) {
    return res.status(400).json({ message: "Avatar must be a JPG, JPEG, or PNG image (WEBP is also supported)" });
  }
  const avatarUrl = (await uploadImage(file, "avatars")).secure_url;

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

  if (file.size > 3 * 1024 * 1024) {
    return res.status(400).json({ message: "Image must be 3MB or smaller" });
  }
  if (!/^image\/(jpeg|png|webp)$/.test(file.mimetype)) {
    return res.status(400).json({ message: "Company media must be a JPG, PNG, or WEBP image" });
  }
  const mediaUrl = (await uploadImage(file, `companies/${field}`)).secure_url;

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
