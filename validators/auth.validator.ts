import z from "zod";

const optionalYearMonth = z.preprocess((value) => {
  if (value === "" || value === null || value === undefined) return undefined;
  if (typeof value === "string") {
    const match = value.trim().match(/^(\d{4})-(\d{2})/);
    if (match) return `${match[1]}-${match[2]}`;
  }
  return value;
}, z.string().regex(/^\d{4}-\d{2}$/, "Use YYYY-MM format").optional());

const passwordSchema = z
  .string()
  .min(6, "Password must be at least 6 characters")
  .max(128)
  .regex(/[A-Z]/, "Password must contain at least one uppercase letter")
  .regex(/[a-z]/, "Password must contain at least one lowercase letter")
  .regex(/[0-9]/, "Password must contain at least one number")
  .regex(
    /[!@#$%^&*(),.?":{}|<>_\-\\[\]/+=~`';]/,
    "Password must contain at least one special character",
  );

export const registerSchema = z
  .object({
    name: z
      .string()
      .trim()
      .min(2, "Name must be at least 2 characters")
      .max(100),
    email: z.email("Enter a valid email address").trim().toLowerCase(),
    password: passwordSchema,
    role: z.enum(["JOB_SEEKER", "COMPANY_ADMIN"]).default("JOB_SEEKER"),
    companyName: z.string().trim().min(2).max(150).optional(),
    phone: z.string().trim().min(8).max(30).optional(),
  })
  .superRefine((data, context) => {
    if (data.role !== "COMPANY_ADMIN") return;
    for (const field of ["companyName", "phone"] as const) {
      if (!data[field])
        context.addIssue({
          code: "custom",
          path: [field],
          message: `${field} is required for company registration`,
        });
    }
  });

export const loginSchema = z.object({
  email: z.email("Enter a valid email address").trim().toLowerCase(),
  password: z.string().min(1, "Password is required").max(128),
});

export const googleLoginSchema = z.object({
  credential: z.string().min(20, "Google credential is required"),
});

export const tokenSchema = z.object({ token: z.string().min(20) });

export const emailSchema = z.object({
  email: z.email("Enter a valid email address").trim().toLowerCase(),
});

export const resetPasswordSchema = tokenSchema.extend({
  password: passwordSchema,
});

export const updateProfileSchema = z.object({
  name: z.string().trim().min(2).max(100).optional(),
  email: z.email("Enter a valid email address").trim().toLowerCase().optional(),
  birthDate: z.coerce.date().optional(),
  gender: z.enum(["MALE", "FEMALE"]).optional(),
  lastEducation: z.string().trim().max(100).optional(),
  address: z.string().trim().max(2000).optional(),
  city: z.string().trim().max(100).optional(),
  province: z.string().trim().max(100).optional(),
  professionalRole: z.string().trim().max(150).optional(),
  availability: z.enum([
    "Open to Work",
    "Actively Interviewing",
    "Available for Freelance",
    "Not Looking",
  ]).optional(),
  profileIntro: z.string().trim().max(1000).optional(),
  salaryExpectation: z.string().trim().max(150).optional(),
  profileStory: z.string().trim().max(10_000).optional(),
  skills: z.array(z.string().trim().min(1).max(100)).max(50).optional(),
  profileLinks: z.array(z.object({ label: z.string().trim().min(1).max(50), url: z.url().or(z.string().startsWith("mailto:")) })).max(10).optional(),
  experiences: z.array(z.object({ title: z.string().trim().min(1).max(150), company: z.string().trim().min(1).max(150), companyId: z.number().int().positive().optional(), period: z.string().trim().max(100), note: z.string().trim().max(2000) })).max(20).optional(),
  selectedWork: z.array(z.object({
    name: z.string().trim().min(1).max(200),
    note: z.string().trim().max(2000),
    url: z.url().or(z.literal("")).optional(),
    company: z.string().trim().max(150).optional(),
    date: optionalYearMonth,
  })).max(20).optional(),
  isPublicProfile: z.boolean().optional(),
  companyName: z.string().trim().min(2).max(150).optional(),
  phone: z.string().trim().min(8).max(30).optional(),
  profileContent: z.string().max(50_000).optional(),
  companyCity: z.string().trim().min(2).max(100).optional(),
  companyProvince: z.string().trim().max(120).optional(),
  companyCountry: z.string().trim().min(2).max(120).optional(),
  companyTagline: z.string().trim().max(300).optional(),
  companySize: z.enum([
    "2–10 people",
    "11–50 people",
    "51–200 people",
    "201–500 people",
    "501–1,000 people",
    "1,001–5,000 people",
    "5,001–10,000 people",
    "10,001+ people",
  ]).or(z.literal("")).optional(),
  companyFounded: z.coerce.number().int().min(1800).max(2100).optional(),
  companyWebsite: z.url().or(z.literal("")).optional(),
  companyProducts: z.array(z.object({
    name: z.string().trim().min(1).max(200),
    url: z.url().or(z.literal("")),
    description: z.string().trim().max(2000),
  })).max(30).optional(),
  companyValues: z.array(z.string().trim().min(1).max(500)).max(12).optional(),
  companyPerks: z.array(z.string().trim().min(1).max(500)).max(12).optional(),
});

export const changePasswordSchema = z.object({
  currentPassword: z.string().min(1),
  newPassword: passwordSchema,
});

export type RegisterInput = z.infer<typeof registerSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
export type UpdateProfileInput = z.infer<typeof updateProfileSchema>;
