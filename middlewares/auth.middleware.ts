import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import { ApiError } from "../utils/api-error.js";
import { UserRole } from "../generated/prisma/enums.js";

export interface AuthenticatedRequest extends Request {
    user: {
        id: number;
        role: UserRole;
    };
}

export const verifyToken = (secretKey: string) => {
    return (req: Request, res: Response, next: NextFunction) => {
        try {
            const authHeader = req.headers.authorization;

            if (!authHeader || !authHeader.startsWith("Bearer ")) {
                throw new ApiError("Unauthorized, token missing", 401);
            }

            const token = authHeader.split(" ")[1];

            const decoded = jwt.verify(token, secretKey) as {
                id: number;
                role: UserRole;
            };

            res.locals.user = {
                id: decoded.id,
                role: decoded.role,
            };

            (req as AuthenticatedRequest).user = {
                id: decoded.id,
                role: decoded.role,
            };

            next();
        } catch (error: any) {
            next(new ApiError(error.message || "Invalid Token", 401));
        }
    };
};

export const verifyRole = (...allowedRoles: UserRole[]) => {
    return (req: Request, _res: Response, next: NextFunction) => {
        const user = (req as AuthenticatedRequest).user;

        if (!user) {
            return next(new ApiError("Unauthenticated", 401));
        }

        if (!allowedRoles.includes(user.role)) {
            return next(new ApiError("Unauthorized", 403));
        }

        next();
    };
};
