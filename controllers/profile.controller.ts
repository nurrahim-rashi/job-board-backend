import type { Request, Response } from "express";
import { getPublicSeekerProfile } from "../services/profile.service.js";
import { ApiError } from "../utils/api-error.js";

export async function getPublicProfileController(req: Request, res: Response) {
  const userId = Number(req.params.userId);
  if (!Number.isInteger(userId)) throw new ApiError("User id is invalid", 400);
  res.status(200).json({ data: await getPublicSeekerProfile(userId) });
}
