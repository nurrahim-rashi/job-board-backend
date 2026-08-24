import { _isoDuration } from "zod/v4/core"
import type { JobApplication, Prisma } from "../generated/prisma/client.js"
import { prisma } from "../lib/prisma.js"
import { finalizeTest, getActiveSession } from "./test-session.service.js"

type ApplicationWithJob = Prisma.JobApplicationGetPayload<{
    include: {job: true}
}>

export const submitTestService = async (application:ApplicationWithJob) => {
    const {result} = await getActiveSession(application);

    return finalizeTest(result.id)
}