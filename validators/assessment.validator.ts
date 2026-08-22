import z from "zod";

export const createAssessmentSchema = z.object({
  skillName: z
    .string({
      message: "Skill name is required",
    })
    .min(1, "Skill name is required"),

  title: z
    .string({
      message: "Title is required",
    })
    .min(1, "Title is required"),

  description: z.string().optional(),
});

export type CreateAssessmentSchema = z.infer<typeof createAssessmentSchema>;
