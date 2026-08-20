import type { Request, Response } from "express";
import { getAuthenticatedUser, loginUser, registerUser } from "../services/auth.service.js";
import { type AuthenticatedRequest } from "../middlewares/auth.middleware.js";

export async function registerController(req: Request, res: Response) {
  const session = await registerUser(req.body);
  return res.status(201).json({ message: "Account created successfully", data: session });
}

export async function loginController(req: Request, res: Response) {
  const session = await loginUser(req.body);
  return res.status(200).json({ message: "Signed in successfully", data: session });
}

export async function meController(req: Request, res: Response) {
  const user = await getAuthenticatedUser((req as AuthenticatedRequest).user.id);
  return res.status(200).json({ data: user });
}

export function logoutController(_req: Request, res: Response) {
  return res.status(204).send();
}
