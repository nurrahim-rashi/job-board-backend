import type { NextFunction, Request, Response } from "express";
import {
  getMySavedJobIds,
  getMySavedJobsPage,
  saveJob,
  unsaveJob,
} from "../services/saved-job.service.js";
import type { AuthenticatedRequest } from "../middlewares/auth.middleware.js";

export async function saveJobController(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    const data = await saveJob(
      (req as AuthenticatedRequest).user.id,
      String(req.params.slug),
    );
    res.status(201).json({ message: "Job saved", data });
  } catch (error) {
    next(error);
  }
}

export async function unsaveJobController(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    await unsaveJob(
      (req as AuthenticatedRequest).user.id,
      String(req.params.slug),
    );
    res.status(200).json({ message: "Job removed from saved jobs" });
  } catch (error) {
    next(error);
  }
}

export async function listMySavedJobsController(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    const page = Math.min(10_000, Math.max(1, Number(req.query.page) || 1));
    const limit = Math.min(20, Math.max(1, Number(req.query.limit) || 8));
    const data = await getMySavedJobsPage(
      (req as AuthenticatedRequest).user.id,
      page,
      limit,
    );
    res.status(200).json({ data });
  } catch (error) {
    next(error);
  }
}

export async function listMySavedJobIdsController(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    const data = await getMySavedJobIds((req as AuthenticatedRequest).user.id);
    res.status(200).json({ data });
  } catch (error) {
    next(error);
  }
}
