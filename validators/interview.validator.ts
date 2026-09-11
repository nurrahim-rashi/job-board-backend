import z from "zod";
import { InterviewStatus } from "../generated/prisma/enums.js";

const interviewDate = z.coerce
  .date({ error: () => "Interview date is invalid" })
  .refine((date) => date.getTime() > Date.now(), {
    message: "Interview date must be in the future",
  });

const locationOrLink = z
  .string()
  .trim()
  .min(1, "Interview location or meeting link is required")
  .max(255, "Maximum 255 characters");

const notes = z.string().trim().max(500, "Maximum 500 characters").nullish();

const scheduleSchema = z.object({
  applicationId: z.coerce
    .number()
    .int()
    .positive("Applicant is invalid"),
  interviewDate,
  locationOrLink,
  notes,
});

export const createInterviewSchema = z
  .object({
    schedules: z
      .array(scheduleSchema)
      .min(1, "At least one interview schedule is required")
      .max(20, "Maximum 20 interview schedules per request"),
  })
  .refine(
    (data) =>
      new Set(data.schedules.map((s) => s.applicationId)).size ===
      data.schedules.length,
    {
      message: "An applicant can only be scheduled once",
      path: ["schedules"],
    },
  )
  .refine(
    (data) =>
      new Set(data.schedules.map((s) => s.interviewDate.getTime())).size ===
      data.schedules.length,
    {
      message: "Each applicant must receive a different interview schedule",
      path: ["schedules"],
    },
  );

export const updateInterviewSchema = z
  .object({
    interviewDate: interviewDate.optional(),
    locationOrLink: locationOrLink.optional(),
    notes,
    status: z
      .enum(InterviewStatus, {
        error: () => "Status must be SCHEDULED, COMPLETED, or CANCELLED",
      })
      .optional(),
  })
  .refine((data) => Object.keys(data).length > 0, {
    message: "At least one field must be provided",
  });

export const interviewQuerySchema = z
  .object({
    page: z.coerce.number().int().min(1).default(1),
    limit: z.coerce.number().int().min(1).max(50).default(10),
    status: z.enum(InterviewStatus).optional(),
    dateFrom: z.coerce.date().optional(),
    dateTo: z.coerce.date().optional(),
    sortOrder: z.enum(["asc", "desc"]).default("asc"),
  })
  .refine(
    (data) =>
      !data.dateFrom || !data.dateTo || data.dateTo.getTime() >= data.dateFrom.getTime(),
    {
      message: "dateTo should be greater than dateFrom",
      path: ["dateTo"],
    },
  );

export type CreateInterviewInput = z.infer<typeof createInterviewSchema>;
export type UpdateInterviewInput = z.infer<typeof updateInterviewSchema>;
export type InterviewQueryInput = z.infer<typeof interviewQuerySchema>;
