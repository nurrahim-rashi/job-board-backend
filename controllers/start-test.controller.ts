import { NextFunction, Request, Response } from "express";
import { startTestService } from "../services/pre-selection-test/start-test.service.js";


export const startTestController = async (
    req: Request,
    res: Response,
    next: NextFunction
) => {
    try {
        const application = req.application!;
        const result = await startTestService(application)
        res.status(200).send(result)
    } catch (error) {
        next(error)
    }
}

