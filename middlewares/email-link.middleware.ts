import type { RequestHandler } from "express";
import { tokenSchema } from "../validators/auth.validator.js";
import { invalidEmailLink, type EmailLinkPurpose } from "../utils/email-link.js";

export const validateEmailLinkToken = (purpose: EmailLinkPurpose): RequestHandler =>
  (req, _res, next) => {
    if (!tokenSchema.safeParse(req.body).success) return next(invalidEmailLink(purpose));
    next();
  };
