import { prisma } from "../lib/prisma.js";

export const createReviewService = async (
    userId: number,
    companyId: number,
    data: {
        jobTitleHeld: string;
        salaryEstimate?: number;
        ratingCulture: number;
        ratingWorkLife: number;
        ratingFacility: number;
        ratingCareer: number;
        reviewText: string;
    },
) => {
    // Cek user diterima di perusahaan apa ngga
    const employment = await prisma.jobApplication.findFirst({
        where: {
            userId,
            job: {
                companyId,
            },
            status: "ACCEPTED",
        },
    });

    if (!employment) {
        throw new Error ("You can only review a company if you are a verified employee",);
    }

    // Cek user pernah review sebelumnya apa ngga
    const existingReview = await prisma.companyReview.findFirst({
        where: {
            userId,
            companyId,
        },
    });

    if (existingReview) {
        throw new Error("You have already reviewed this company");
    }

    // Validasi ratings
    const ratings = [
        data.ratingCulture,
        data.ratingWorkLife,
        data.ratingFacility,
        data.ratingCareer,
    ];

    if (ratings.some((rating) => rating < 1 || rating > 5)) {
        throw new Error("Ratings must be between 1 and 5");
    }

    // Create company review
    return await prisma.companyReview.create({
        data: {
            userId,
            companyId,
            jobTitleHeld: data.jobTitleHeld,
            salaryEstimate: data.salaryEstimate,
            ratingCulture: data.ratingCulture,
            ratingWorkLife: data.ratingWorkLife,
            ratingFacility: data.ratingFacility,
            ratingCareer: data.ratingCareer,
            reviewText: data.reviewText,
        },
    });
};