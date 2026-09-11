import { NextFunction, Request, Response } from "express";
import { ZodError, ZodType } from "zod";
import { ApiError } from "../utils/api-error.js";

const describe = (error: ZodError) =>
  error.issues
    .map((issue) => `${issue.path.join(".")}: ${issue.message}`)
    .join(", ");

export const validate = (schema: ZodType) => {
  return (req: Request, res: Response, next: NextFunction) => {
    try {
      req.body = schema.parse(req.body);
      next();
    } catch (error) {
      if (error instanceof ZodError) {
        return next(new ApiError(describe(error), 400));
      }

      next(error);
    }
  };
};


export const parseQuery = <T>(schema: ZodType<T>, query: unknown): T => {
  try {
    return schema.parse(query);
  } catch (error) {
    if (error instanceof ZodError) {
      throw new ApiError(describe(error), 400);
    }

    throw error;
  }
};
