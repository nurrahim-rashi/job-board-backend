import type { NextFunction, Request, Response } from "express";
import { prisma } from "../lib/prisma.js";
import { ApiError } from "../utils/api-error.js";

export const jobOwnership = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const slug = req.params.slug;
    if (typeof slug !== "string" || !slug) {
      throw new ApiError("Lowongan tidak ditemukan", 404);
    }
  const job = await prisma.jobPosting.findFirst({
    where: {slug, deletedAt: null},
    include: {
      company: {select: {userId: true}}
    }
  })

  if (!job || job.company.userId !== req.user?.id) {
  throw new ApiError("Lowongan tidak ditemukan", 404);
}

req.job = job;
next();

  } catch (error) {
    next(error)
  }
};
