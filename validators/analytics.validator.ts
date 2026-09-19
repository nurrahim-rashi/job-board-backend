import { z } from "zod";
import { JobCategory } from "../generated/prisma/enums.js";
import { currencyCodeSchema } from "../utils/currency.js";

export const analyticsQuerySchema = z.object({
  months: z.coerce
    .number()
    .int()
    .min(3, "Minimum range is 3 months")
    .max(24, "Maximum range is 24 months")
    .default(6),
  category: z
    .enum(JobCategory, { error: () => "Unknown job category" })
    .optional(),
  limit: z.coerce.number().int().min(3).max(20).default(8),
  currency: currencyCodeSchema.default("IDR"),
});

export type AnalyticsQueryInput = z.infer<typeof analyticsQuerySchema>;
