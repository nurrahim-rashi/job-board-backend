import { NextFunction, Request, Response } from "express"
import type { UserRole } from "../generated/prisma/enums.js"
import { ApiError } from "../utils/api-error.js"

export const verifyRole = (...allowedRoles: UserRole[]) => {
    return (req: Request, res: Response, next: NextFunction) => {
        if (!req.user){
            throw new ApiError("unauthenticated", 401)
        }

        if(!allowedRoles.includes(req.user.role)){
            throw new ApiError("unauthorized", 403)
        }

        next();
    }
}