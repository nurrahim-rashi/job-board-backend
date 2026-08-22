import express from "express";
import {
  changePasswordController,
  forgotPasswordController,
  loginController,
  logoutController,
  meController,
  registerController,
  resendVerificationController,
  resetPasswordController,
  updateProfileController,
  uploadAvatarController,
  verifyEmailController,
} from "../controllers/auth.controller.js";
import { verifyToken } from "../middlewares/auth.middleware.js";
import { validate } from "../middlewares/validation.middleware.js";
import {
  changePasswordSchema,
  emailSchema,
  loginSchema,
  registerSchema,
  resetPasswordSchema,
  tokenSchema,
  updateProfileSchema,
} from "../validators/auth.validator.js";

export const authRoutes = express.Router();
const authenticated = verifyToken(process.env.JWT_SECRET!);

authRoutes.post("/register", validate(registerSchema), registerController);
authRoutes.post("/login", validate(loginSchema), loginController);
authRoutes.post("/verify-email", validate(tokenSchema), verifyEmailController);
authRoutes.post("/resend-verification", validate(emailSchema), resendVerificationController);
authRoutes.post("/forgot-password", validate(emailSchema), forgotPasswordController);
authRoutes.post("/reset-password", validate(resetPasswordSchema), resetPasswordController);
authRoutes.get("/me", authenticated, meController);
authRoutes.patch("/profile", authenticated, validate(updateProfileSchema), updateProfileController);
authRoutes.put("/avatar", authenticated, express.raw({ type: ["image/jpeg", "image/png"], limit: "1mb" }), uploadAvatarController);
authRoutes.post("/change-password", authenticated, validate(changePasswordSchema), changePasswordController);
authRoutes.post("/logout", authenticated, logoutController);
