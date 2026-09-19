import z from "zod";

export const currencyCodeSchema = z.preprocess(
  (value) =>
    typeof value === "string" ? value.trim().toLocaleUpperCase("en") : value,
  z.string().regex(/^[A-Z]{3}$/, "Choose a valid ISO currency"),
);

export function currencyCode(value: unknown, fallback = "IDR") {
  const result = currencyCodeSchema.safeParse(value ?? fallback);
  return result.success ? result.data : fallback;
}
