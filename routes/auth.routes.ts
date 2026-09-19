import express from "express";
import {
  changePasswordController,
  forgotPasswordController,
  googleLoginController,
  homepageController,
  loginController,
  logoutController,
  meController,
  registerController,
  resendVerificationController,
  resetPasswordController,
  subscriptionStatusController,
  updateProfileController,
  uploadAvatarController,
  removeAvatarController,
  uploadCompanyMediaController,
  removeCompanyMediaController,
  verifyEmailController,
} from "../controllers/auth.controller.js";
import { verifyToken } from "../middlewares/auth.middleware.js";
import { validate } from "../middlewares/validation.middleware.js";
import {
  changePasswordSchema,
  emailSchema,
  googleLoginSchema,
  loginSchema,
  registerSchema,
  resetPasswordSchema,
  tokenSchema,
  updateProfileSchema,
} from "../validators/auth.validator.js";
import multer from "multer";
const upload = multer({ storage: multer.memoryStorage() });

export const authRoutes = express.Router();
const authenticated = verifyToken(process.env.JWT_SECRET!);

authRoutes.post("/register", validate(registerSchema), registerController);
authRoutes.post("/login", validate(loginSchema), loginController);
authRoutes.post("/google", validate(googleLoginSchema), googleLoginController);
authRoutes.post("/verify-email", validate(tokenSchema), verifyEmailController);
authRoutes.post(
  "/resend-verification",
  validate(emailSchema),
  resendVerificationController,
);
authRoutes.post(
  "/forgot-password",
  validate(emailSchema),
  forgotPasswordController,
);
authRoutes.post(
  "/reset-password",
  validate(resetPasswordSchema),
  resetPasswordController,
);
authRoutes.get("/me", authenticated, meController);
authRoutes.get("/homepage", authenticated, homepageController);
authRoutes.get(
  "/subscription-status",
  authenticated,
  subscriptionStatusController,
);
authRoutes.patch(
  "/profile",
  authenticated,
  validate(updateProfileSchema),
  updateProfileController,
);
authRoutes.put(
  "/avatar",
  authenticated,
  upload.single("avatar"),
  uploadAvatarController,
);
authRoutes.delete("/avatar", authenticated, removeAvatarController);
authRoutes.put(
  "/company-media/:field",
  authenticated,
  upload.single("media"),
  uploadCompanyMediaController,
);
authRoutes.delete(
  "/company-media/:field",
  authenticated,
  removeCompanyMediaController,
);
authRoutes.post(
  "/change-password",
  authenticated,
  validate(changePasswordSchema),
  changePasswordController,
);
authRoutes.post("/logout", authenticated, logoutController);
