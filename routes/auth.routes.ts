import express from "express";
import { loginController, logoutController, meController, registerController } from "../controllers/auth.controller.js";
import { verifyToken } from "../middlewares/auth.middleware.js";
import { validate } from "../middlewares/validation.middleware.js";
import { loginSchema, registerSchema } from "../validators/auth.validator.js";

export const authRoutes = express.Router();

authRoutes.post("/register", validate(registerSchema), registerController);
authRoutes.post("/login", validate(loginSchema), loginController);
authRoutes.get("/me", verifyToken(process.env.JWT_SECRET!), meController);
authRoutes.post("/logout", verifyToken(process.env.JWT_SECRET!), logoutController);
