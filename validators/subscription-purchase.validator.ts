import z from "zod";

export const purchaseSubscriptionSchema = z.object({
  plan: z.enum(["STANDARD", "PROFESSIONAL"]),
});

export type PurchaseSubscriptionSchema = z.infer<
  typeof purchaseSubscriptionSchema
>;
