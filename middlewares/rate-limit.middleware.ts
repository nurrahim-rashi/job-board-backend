import rateLimit from "express-rate-limit";

/**
 * Nothing in front of these endpoints throttled repeated attempts, so a single
 * client could brute force a password or make the app send unlimited email.
 * Counting per IP is coarse behind a proxy, but it is the layer the app can
 * apply on its own.
 */
const limiter = (windowMinutes: number, max: number, message: string) =>
  rateLimit({
    windowMs: windowMinutes * 60 * 1000,
    limit: max,
    standardHeaders: "draft-7",
    legacyHeaders: false,
    // Failed attempts are what we care about; a correct login should not eat
    // the allowance of the next person behind the same office NAT.
    skipSuccessfulRequests: true,
    message: { message },
  });

export const credentialsLimiter = limiter(
  15,
  10,
  "Too many sign-in attempts. Try again in a few minutes.",
);

export const emailDispatchLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  limit: 5,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  message: {
    message: "Too many email requests. Try again in an hour.",
  },
});

export const registrationLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  limit: 10,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  message: { message: "Too many accounts created. Try again in an hour." },
});
