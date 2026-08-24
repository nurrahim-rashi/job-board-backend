import { NextFunction, Request, Response } from "express";
import { saveAnswerService } from "../services/save-answer.service.js";
import { SaveAnswerInput } from "../validators/pre-selection-test.validator.js";
import { submitTestService } from "../services/submit-test.service.js";



export const saveAnswerController = async (
    req: Request,
    res: Response,
    next: NextFunction,
) => {
    try {
        const result = await saveAnswerService(req.application!, req.body as SaveAnswerInput);
        res.status(200).send(result)
    } catch (error) {
        next(error)
    }
}

export const submitTestController = async (
    req: Request,
    res: Response,
    next: NextFunction,
) => {
    try {
        const result = await submitTestService(req.application!)
        res.status(200).send(result)
    } catch (error) {
        next(error)   
    }
}