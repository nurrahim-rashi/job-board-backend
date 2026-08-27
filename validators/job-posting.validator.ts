import z, { refine } from "zod";
import { JobCategory } from "../generated/prisma/enums.js";

const jobFields = z.object({
  title: z.string().trim().min(1, "Job title is required"),
  description: z.string().trim().min(1, "description is required"),
  banner: z.string().trim().optional(),
  category: z.enum(JobCategory, {
    error: () => "Selected category is invalid",
  }),
  cityLocation: z.string().trim().min(1, "City location is required"),
  salaryMin: z
    .number()
    .int()
    .positive("Minimum salary should be greater than 0")
    .optional(),
  salaryMax: z
    .number()
    .int()
    .positive("Maximum salary should be greater than 0")
    .optional(),
  tags: z.array(z.string().trim().min(1)).max(10, "Maximum 10 Tags").optional(),
  deadline: z.coerce
    .date()
    .refine((d) => d > new Date(), "Deadline must be in the future"),
});

const salaryRangeCheck = (data: { salaryMin?: number; salaryMax?: number }) =>
  data.salaryMin === undefined ||
  data.salaryMax === undefined ||
  data.salaryMax > data.salaryMin;

const salaryRangeMessage = {
  message: "Maximum Salary should be greater than minimum Salary",
  path: ["maxSalary"],
};

export const createJobSchema = jobFields.refine(
  salaryRangeCheck,
  salaryRangeMessage,
);

export const updateJobSchema = jobFields
  .partial()
  .refine(salaryRangeCheck, salaryRangeMessage)
  .refine((data) => Object.keys(data).length > 0, {
    message: "No data was modified",
  });

export const jobQuerySchema = z.object({
    page: z.coerce.number().int().min(1).default(1),
    limit: z.coerce.number().int().min(1).max(50).default(10),
    search: z.string().trim().optional(),
    category: z.enum(JobCategory).optional(),
    sortBy: z.enum(["createdAt", "deadline", "title"]).default("createdAt"),
    sortOrder: z.enum(["asc", "desc"]).default("desc"),
})  

export const publishSchema = z.object({
  isPublished: z.boolean(),
})

export type CreateJobInput = z.infer<typeof createJobSchema>;
export type UpdateJobInput = z.infer<typeof updateJobSchema>;
export type JobQueryInput = z.infer<typeof jobQuerySchema>
export type PublishInput = z.infer<typeof publishSchema>