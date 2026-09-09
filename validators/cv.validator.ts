import { z } from "zod";

const workExperienceSchema = z
  .object({
    jobTitle: z.string().trim().min(1, "Job title is required"),
    company: z.string().trim().min(1, "Company is required"),
    startDate: z.string().trim().min(1, "Start date is required"),
    endDate: z.string().trim().optional(),
    isCurrent: z.boolean(),
    description: z.string().trim().min(1, "Description is required"),
  })
  .refine((data) => data.isCurrent || Boolean(data.endDate), {
    message: "End date is required for previous work experience",
    path: ["endDate"],
  });

const educationSchema = z.object({
  institution: z.string().trim().min(1, "Institution is required"),
  degree: z.string().trim().min(1, "Degree is required"),
  fieldOfStudy: z.string().trim().optional(),
  startYear: z.number().int().min(1900).max(2100).optional(),
  endYear: z.number().int().min(1900).max(2100).optional(),
});

const projectSchema = z.object({
  name: z.string().trim().min(1, "Project name is required"),
  description: z.string().trim().min(1, "Project description is required"),
  technologies: z.array(z.string().trim().min(1)).optional(),
});

const languageSchema = z.object({
  language: z.string().trim().min(1, "Language is required"),
  proficiency: z.string().trim().optional(),
});

export const generateCvSchema = z.object({
  professionalSummary: z
    .string()
    .trim()
    .min(1, "Professional summary is required"),

  phone: z.string().trim().optional(),

  skills: z
    .array(z.string().trim().min(1))
    .min(1, "At least one skill is required"),

  workExperiences: z.array(workExperienceSchema),

  educations: z
    .array(educationSchema)
    .min(1, "At least one education entry is required"),

  projects: z.array(projectSchema).optional(),

  languages: z.array(languageSchema).optional(),
});
