import type { JobPosting } from "../generated/prisma/client.ts";
import type { UserRole } from "../generated/prisma/enums.ts";

declare global {
    namespace Express {
        interface Request {
            job?: JobPosting;
            user?: {
                id: number;
                role: UserRole;
            };
        }
    }
}

export {};
