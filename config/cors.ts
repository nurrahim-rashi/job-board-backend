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

    callback(new Error(`Origin ${origin} is not allowed by CORS`));
  },
  credentials: true,
  allowedHeaders: ["Content-Type", "Authorization"],
  methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
};
