import { NextFunction, Request, Response } from "express";
import { sendInterviewRemindersService } from "../services/interview-management/interview-reminder.service.js";

export const runInterviewReminderController = async (
  _req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const result = await sendInterviewRemindersService();

    console.log(
      `[interview reminder] found ${result.found}, sent ${result.sent}, failed ${result.failed}`,
    );
    res.status(200).json({ data: result });
  } catch (error) {
    next(error);
  }
};
