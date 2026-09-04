import type { NextFunction, Request, Response } from "express";
import { createApplication, getMyApplicationDetail, getMyApplications } from "../services/application.service.js";
import { ApiError } from "../utils/api-error.js";
import type { AuthenticatedRequest } from "../middlewares/auth.middleware.js";

export async function createApplicationController(req: Request, res: Response, next: NextFunction) {
  try {
    if (!req.file) throw new ApiError("CV PDF is required", 400);
    const expectedSalary = req.body.expectedSalary ? Number(req.body.expectedSalary) : undefined;
    if (expectedSalary !== undefined && (!Number.isInteger(expectedSalary) || expectedSalary <= 0)) throw new ApiError("Expected salary must be a positive number", 400);
    const data = await createApplication((req as AuthenticatedRequest).user.id, String(req.params.slug), req.file, expectedSalary);
    res.status(201).json({ message: "Application submitted successfully", data });
  } catch (error) { next(error); }
}

export async function listMyApplicationsController(req: Request, res: Response, next: NextFunction) {
  try { res.status(200).json({ data: await getMyApplications((req as AuthenticatedRequest).user.id) }); } catch (error) { next(error); }
}

export async function getMyApplicationDetailController(req: Request, res: Response, next: NextFunction) {
  try {
    const id = Number(req.params.applicationId);
    if (!Number.isInteger(id)) throw new ApiError("Application id is invalid", 400);
    res.status(200).json({ data: await getMyApplicationDetail((req as AuthenticatedRequest).user.id, id) });
  } catch (error) { next(error); }
}
