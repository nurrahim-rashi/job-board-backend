import { z } from "zod";
import { AnswerOption } from "../generated/prisma/enums.js";

export const questionSchema = z.object({
  question: z.string().trim().min(1, "This question is required"),
  options: z
    .array(z.string().trim().min(1, "Options cannot be empty"))
    .length(4, "Must have 4 answer options")
    .refine(
      (options) =>
        new Set(options.map((o) => o.toLowerCase())).size === options.length,
      {
        message: "Options must be unique",
      },
    ),
  correctAnswer: z.enum(AnswerOption, {
    error: () => "Correct answer must be A, B, C, or D",
  }),
});

export const saveTestSchema = z.object({
  questions: z
    .array(questionSchema)
    .min(1, "At least one question is required")
    .max(25, "Maximum 25 questions"),
});

export const activationSchema = z.object({
  hasPreSelectionTest: z.boolean(),
  testDurationMinutes: z
    .number()
    .int()
    .positive("Minimum test duration is 1 minute")
    .optional(),
});

export const saveAnswerSchema = z.object({
  questionId: z.number().int().positive("Invalid questionId"),
  selectedAnswer: z.enum(AnswerOption, {
    error: () => "Answer must be A, B, C, or D"
  })
})

export const assignTestSchema = z.object({
  applicationIds: z.array(z.number().int().positive()).min(1, "Select at least 1 candidate").max(59, "Maximum 50 candidates per submission")
})

export type QuestionInput = z.infer<typeof questionSchema>;
export type SaveTestInput = z.infer<typeof saveTestSchema>;
export type ActivationInput = z.infer<typeof activationSchema>;
export type SaveAnswerInput = z.infer<typeof saveAnswerSchema>
export type AssignTestInput = z.infer<typeof assignTestSchema>