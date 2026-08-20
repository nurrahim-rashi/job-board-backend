import { Response } from "express";
import { createReviewService } from "../services/review.service.js";
import { createReviewSchema } from "../validators/review.validator.js";

export const createReviewController = async (
    req: any,
    res: Response,
) => {
    const userId = req.user.id;
    const companyId = Number(req.params.companyId);

    const review = await createReviewService(
        userId,
        companyId,
        req.body,
    );

    return res.status(201).json({
        message: "Company review created successfully",
        data: review,
    });
};