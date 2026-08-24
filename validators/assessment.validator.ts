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

export const createAssessmentQuestionSchema = z.object({
  question: z
  .string({
    message: "Question is required",
  })
  .min(1, "Question cannot be empty"),

  options: z.object({
    A: z.string().min(1, "Option A cannot be empty"),
    B: z.string().min(1, "Option B cannot be empty"),
    C: z.string().min(1, "Option C cannot be empty"),
    D: z.string().min(1, "Option D cannot be empty"),
  }),

  correctAnswer: z.enum(["A", "B", "C", "D"]),

  questionOrder: z
  .number({
    message: "Question order is required",
  })
  .int("Question order must be an integer")
  .min(1, "Question order must start from 1")
  .max(25, "Question order cannot exceed 25"),
});

export type CreateAssessmentQuestionSchema = z.infer<typeof createAssessmentQuestionSchema>;