import { ApiError } from "../utils/api-error.js";

const configuredFrontendUrl = process.env.FRONTEND_URL?.replace(/\/$/, "");
const allowedOrigins = new Set(
  [
    configuredFrontendUrl,
    "https://www.polarisjobs.my.id",
    "https://polarisjobs.my.id",
    ...(process.env.NODE_ENV === "production"
      ? []
      : ["http://localhost:5173"]),
  ].filter((origin): origin is string => Boolean(origin)),
);

export const corsOptions = {
  origin: (origin: string | undefined, callback: (error: Error | null, allowed?: boolean) => void) => {
    if (!origin || allowedOrigins.has(origin)) {
      callback(null, true);
      return;
    }

    // A plain Error here reaches the error handler as an unknown failure and
    // answers 500, which reads like the API is down rather than like the
    // origin being refused.
    callback(new ApiError(`Origin ${origin} is not allowed by CORS`, 403));
  },
  credentials: true,
  allowedHeaders: ["Content-Type", "Authorization"],
  methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
};
