import { z } from "zod";
import { AnswerOption } from "../generated/prisma/enums.js";

export const questionSchema = z.object({
  question: z.string().trim().min(1, "Pertanyaan wajib diisi"),
  options: z
    .array(z.string().trim().min(1, "Pilihan tidak boleh kosong"))
    .length(4, "Harus 4 pilihan jawaban")
    .refine(
      (options) =>
        new Set(options.map((o) => o.toLowerCase())).size === options.length,
      {
        message: "Pilihan tidak boleh ada yang sama",
      },
    ),
  correctAnswer: z.enum(AnswerOption, {
    error: () => "Jawaban benar harus A, B, C atau D",
  }),
});

export const saveTestSchema = z.object({
  questions: z
    .array(questionSchema)
    .min(1, "Minimal ada satu soal")
    .max(25, "Maksimal 25 soal"),
});

export const activationSchema = z.object({
  hasPreSelectionTest: z.boolean(),
  testDurationMinutes: z
    .number()
    .int()
    .positive("Durasi ujian minimal 1 menit")
    .optional(),
});

export type QuestionInput = z.infer<typeof questionSchema>;
export type SaveTestInput = z.infer<typeof saveTestSchema>;
export type ActivationInput = z.infer<typeof activationSchema>;