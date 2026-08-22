import { z } from "zod";
import type { Prisma } from "../generated/prisma/client.js";
import { prisma } from "../lib/prisma.js";

const optionsSchema = z.array(z.string()).length(4)

export const parseOptions = (value: Prisma.JsonValue): string[] => {
    return optionsSchema.parse(value)
}

export const isTestLocked = async (jobId: number): Promise<boolean> => {
    const existing = await prisma.applicantTestResult.findFirst({
        where: { jobId },
        select: { id: true },
    })

    return existing !== null;
}

