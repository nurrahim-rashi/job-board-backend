import type { Prisma } from "../../generated/prisma/client.js"
import { finalizeTest, getActiveSession } from "./test-session.service.js"

type ApplicationWithJob = Prisma.JobApplicationGetPayload<{
    include: {job: true}
}>

export const submitTestService = async (application:ApplicationWithJob) => {
    const {result} = await getActiveSession(application);

    return finalizeTest(result.id)
}
