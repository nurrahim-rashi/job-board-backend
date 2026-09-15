import z from "zod";
import { JobCategory } from "../generated/prisma/enums.js";

const MAX_DATABASE_INTEGER = 2_147_483_647;

const deadlineIsAllowed = (deadline: Date) => {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const maximum = new Date(today);
  maximum.setDate(maximum.getDate() + 360);
  maximum.setHours(23, 59, 59, 999);
  return deadline >= today && deadline <= maximum;
};

const jobFields = z.object({
  title: z.string().trim().min(1, "Job title is required"),
  description: z.string().trim().min(1, "description is required"),
  category: z.enum(JobCategory, {
    error: () => "Selected category is invalid",
  }),
  cityLocation: z.string().trim().min(1, "City location is required"),
  salaryMin: z.coerce
    .number()
    .int()
    .positive("Minimum salary should be greater than 0")
    .max(
      MAX_DATABASE_INTEGER,
      "Minimum salary cannot exceed 2,147,483,647",
    )
    .optional(),
  salaryMax: z.coerce
    .number()
    .int()
    .positive("Maximum salary should be greater than 0")
    .max(
      MAX_DATABASE_INTEGER,
      "Maximum salary cannot exceed 2,147,483,647",
    )
    .optional(),
  tags: z.preprocess(
    (value) => (typeof value === "string" ? value.split(",") : value),
    z.array(z.string().trim().min(1)).max(10, "Maximum 10 Tags").optional(),
  ),
  deadline: z.coerce
    .date()
    .refine(deadlineIsAllowed, "Deadline must be between today and 360 days from today"),
});

const salaryRangeCheck = (data: { salaryMin?: number; salaryMax?: number }) =>
  data.salaryMin === undefined ||
  data.salaryMax === undefined ||
  data.salaryMax > data.salaryMin;

const salaryRangeMessage = {
  message: "Maximum Salary should be greater than minimum Salary",
  path: ["salaryMax"],
};

export const createJobSchema = jobFields.refine(
  salaryRangeCheck,
  salaryRangeMessage,
);

export const updateJobSchema = jobFields
  .partial()
  .refine(salaryRangeCheck, salaryRangeMessage);

export const jobQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(50).default(10),
  search: z.string().trim().optional(),
  category: z.enum(JobCategory).optional(),
  sortBy: z.enum(["createdAt", "deadline", "title"]).default("createdAt"),
  sortOrder: z.enum(["asc", "desc"]).default("desc"),
});

export const publishSchema = z.object({
  isPublished: z.boolean(),
});

export type CreateJobInput = z.infer<typeof createJobSchema>;
export type UpdateJobInput = z.infer<typeof updateJobSchema>;
export type JobQueryInput = z.infer<typeof jobQuerySchema>;
export type PublishInput = z.infer<typeof publishSchema>;
