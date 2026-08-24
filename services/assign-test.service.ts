import { JobPosting } from "../generated/prisma/client.js";
import { ApiError } from "../utils/api-error.js";
import { AssignTestInput } from "../validators/pre-selection-test.validator.js";
import { prisma } from "../lib/prisma.js";
import { count } from "node:console";

export const assignTestService = async (
  job: JobPosting,
  input: AssignTestInput,
) => {
  if (!job.hasPreSelectionTest) {
    throw new ApiError(
      "This job posting does not use a Pre-Selection Test",
      400,
    );
  }

  const { count } = await prisma.jobApplication.updateMany({
    where: {
      id: { in: input.applicationIds },
      jobId: job.id,
      status: "PENDING",
    },
    data: { status: "TEST_ASSIGNED" }
  });

  if (count === 0){
    throw new ApiError("No applications can be sent for the Pre-Selection Test", 409)
  }

  return {
    assignedCount: count,
    skippedCount: input.applicationIds.length-count
  }
};
