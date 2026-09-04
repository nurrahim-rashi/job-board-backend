import z from "zod";

const rangeCheck = (min?: number, max?: number) =>
  min === undefined || max === undefined || max >= min;

export const applicantQuerySchema = z
  .object({
    page: z.coerce.number().int().min(1).default(1),
    limit: z.coerce.number().int().min(1).max(50).default(10),
    name: z.string().trim().optional(),
    minAge: z.coerce.number().int().min(15, "Minimum age is 15").optional(),
    maxAge: z.coerce.number().int().max(80, "Maximum age is 80").optional(),
    minSalary: z.coerce
      .number()
      .int()
      .positive("Expected salary should be greater than 0")
      .optional(),
    maxSalary: z.coerce
      .number()
      .int()
      .positive("Expected salary should be greater than 0")
      .optional(),
    education: z.string().trim().optional(),
    status: z
      .enum([
        "PENDING",
        "TEST_ASSIGNED",
        "PROCESS",
        "INTERVIEW",
        "ACCEPTED",
        "REJECTED",
      ])
      .optional(),
    sortBy: z.enum(["createdAt", "expectedSalary", "name"]).default("createdAt"),
    sortOrder: z.enum(["asc", "desc"]).default("asc"),
  })
  .refine((data) => rangeCheck(data.minAge, data.maxAge), {
    message: "Maximum age should be greater than minimum age",
    path: ["maxAge"],
  })
  .refine((data) => rangeCheck(data.minSalary, data.maxSalary), {
    message: "Maximum salary should be greater than minimum salary",
    path: ["maxSalary"],
  });

export const updateStatusSchema = z
  .object({
    status: z.enum(["PROCESS", "INTERVIEW", "ACCEPTED", "REJECTED"], {
      error: () => "Status must be PROCESS, INTERVIEW, ACCEPTED, or REJECTED",
    }),
    rejectionReason: z
      .string()
      .trim()
      .min(1, "Rejection reason cannot be empty")
      .max(500, "Maximum 500 characters")
      .optional(),
  })
  .refine((data) => data.status !== "REJECTED" || !!data.rejectionReason, {
    message: "Rejection reason is required when rejecting an applicant",
    path: ["rejectionReason"],
  });

export type ApplicantQueryInput = z.infer<typeof applicantQuerySchema>;
export type UpdateStatusInput = z.infer<typeof updateStatusSchema>;
