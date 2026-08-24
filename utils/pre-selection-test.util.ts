import { z } from "zod";
import type { Prisma } from "../generated/prisma/client.js";
import { prisma } from "../lib/prisma.js";

const optionsSchema = z.array(z.string()).length(4);

export const parseOptions = (value: Prisma.JsonValue): string[] => {
  return optionsSchema.parse(value);
};

export const isTestLocked = async (jobId: number): Promise<boolean> => {
  const existing = await prisma.applicantTestResult.findFirst({
    where: { jobId },
    select: { id: true },
  });

  return existing !== null;
};

export const getRemainingSeconds = (
  startedAt: Date,
  durationMinutes: number,
): number => {
  const totalSeconds = durationMinutes * 60;
  const runningTime = Math.floor((Date.now() - startedAt.getTime()) / 1000);
  const remainingSeconds = totalSeconds - runningTime;

  return remainingSeconds > 0 ? remainingSeconds : 0;
};

export const isExpired = (startedAt: Date, durationMinutes: number): boolean =>
  getRemainingSeconds(startedAt, durationMinutes) <= 0;
