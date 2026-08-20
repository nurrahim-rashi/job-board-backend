import { prisma } from "../lib/prisma.js";
import { ApiError } from "../utils/api-error.js";

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
    // Cek perusahaan nya ada apa ngga
    const company = await prisma.company.findUnique({
        where: {
            id: companyId,
        },
    });

    if (!company) {
        throw new ApiError("Company not found", 404);
    }

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
        throw new ApiError ("You can only review a company if you are a verified employee", 403);
    }

    // Cek user pernah review sebelumnya apa ngga
    const existingReview = await prisma.companyReview.findFirst({
        where: {
            userId,
            companyId,
        },
    });

    if (existingReview) {
        throw new ApiError("You have already reviewed this company", 409);
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