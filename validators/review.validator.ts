import z from "zod";

export const createReviewSchema = z.object({
    jobTitleHeld: z
    .string({
        message: "Job title is required",
    })
    .min(1, "Job title cannot be empty")
    .max(100, "Job title too long"),

    salaryEstimate: z.number({
        message: "Salary estimate must be a number"
    })
    .positive("Salary estimate must be greather than 0")
    .optional(),

    ratingCulture: z.number({
        message: "Culture rating is required"
    })
    .min(1, "Culture rating at least 1")
    .max(5, "Culture rating max 5"),

    ratingWorkLife: z.number({
        message: "Work-life balance rating is required"
    })
    .min(1, "Work-life balance rating at least 1")
    .max(5, "Work-life balance rating max 5"),

    ratingFacility: z.number({
        message: "Facility rating is required"
    })
    .min(1, "Facility rating at least 1")
    .max(5, "Facility rating max 5"),

    ratingCareer: z.number({
        message: "Career rating is required"
    })
    .min(1, "Career rating at least 1")
    .max(5, "Career rating max 5"),

    reviewText: z.string({
        message: "Review is required"
    })
    .min(1, "Review cannot be empty")
    .max(2000, "Review too long"),
});

export type CreateReviewSchema = z.infer<typeof createReviewSchema>