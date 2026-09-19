import type { JobPosting, Prisma } from "../generated/prisma/client.js";
import type { UserRole } from "../generated/prisma/enums.js";

type ApplicationWithJob = Prisma.JobApplicationGetPayload<{
  include: { job: true };
}>;

declare global {
  namespace Express {
    interface Request {
      job?: JobPosting;
      user?: {
        id: number;
        role: UserRole;
      };
      application?: ApplicationWithJob;
    }
  }
}

export {};
