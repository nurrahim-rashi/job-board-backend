import z from "zod";

export const updateSubscriptionSchema = z
  .object({
    price: z
      .number()
      .int("Price must be an integer")
      .positive("Price must be greater than 0")
      .optional(),

    durationDays: z
      .number()
      .int("Duration must be an integer")
      .positive("Duration must be greater than 0")
      .optional(),

    featuresAccess: z.record(z.string(), z.unknown()).optional(),
  })
  .refine(
    (data) =>
      data.price !== undefined ||
      data.durationDays !== undefined ||
      data.featuresAccess !== undefined,
    {
      message: "At least one subscription field must be provided",
    },
  );

export type UpdateSubscriptionSchema = z.infer<typeof updateSubscriptionSchema>;
