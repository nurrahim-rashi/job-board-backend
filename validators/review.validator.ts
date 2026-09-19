import z from "zod";
import { currencyCodeSchema } from "../utils/currency.js";

export const createReviewSchema = z.object({
  salaryEstimate: z
    .number({
      message: "Salary estimate must be a number",
    })
    .int("Salary estimate must be a whole number")
    .positive("Salary estimate must be greater than 0")
    .optional(),
  salaryCurrency: currencyCodeSchema.default("IDR"),

  ratingCulture: z
    .number({
      message: "Culture rating is required",
    })
    .int("Culture rating must be a whole number")
    .min(1, "Culture rating at least 1")
    .max(5, "Culture rating max 5"),

  ratingWorkLife: z
    .number({
      message: "Work-life balance rating is required",
    })
    .int("Work-life balance rating must be a whole number")
    .min(1, "Work-life balance rating at least 1")
    .max(5, "Work-life balance rating max 5"),

  ratingFacility: z
    .number({
      message: "Facility rating is required",
    })
    .int("Facility rating must be a whole number")
    .min(1, "Facility rating at least 1")
    .max(5, "Facility rating max 5"),

  ratingCareer: z
    .number({
      message: "Career rating is required",
    })
    .int("Career rating must be a whole number")
    .min(1, "Career rating at least 1")
    .max(5, "Career rating max 5"),

  reviewText: z
    .string({
      message: "Review is required",
    })
    .trim()
    .min(1, "Review cannot be empty")
    .max(2000, "Review too long"),
});

export type CreateReviewSchema = z.infer<typeof createReviewSchema>;
