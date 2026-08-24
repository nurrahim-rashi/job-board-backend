import { NextFunction, Request, Response } from "express";
import { ApiError } from "../utils/api-error.js";
import { prisma } from "../lib/prisma.js";

export const applicationOwnership = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const slug = req.params.slug;
    const userId = req.user?.id;

    if (typeof slug !== "string" || !slug || !userId) {
      throw new ApiError("Application not found", 404);
    }
    const application = await prisma.jobApplication.findFirst({
      where: { userId, job: { slug, deletedAt: null } },
      include: { job: true },
    });
    
    if (!application) {
      throw new ApiError("Application not found", 404);
    }
    req.application = application;
    next();
  } catch (error) {
    next(error);
  }
};
