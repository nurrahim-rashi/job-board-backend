import type { Request, Response } from "express";
import {
  generateCvPdfService,
  getCvDataService,
} from "../services/cv.service.js";
import type { GenerateCvInput } from "../types/cv.type.js";

export const generateCvController = async (req: Request, res: Response) => {
  const userId = res.locals.user.id;
  const input = req.body as GenerateCvInput;

  const cvData = await getCvDataService(userId, input);
  const doc = generateCvPdfService(cvData);

  const filename = "cv.pdf";

  res.setHeader("Content-Type", "application/pdf");
  res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);

  doc.pipe(res);
  doc.end();
};
