import type { Request, Response } from "express";
import { generateAssessmentCertificateService } from "../services/assessment.service.js";
import { generateCertificatePdfService } from "../services/assessment-certificate.service.js";

export const downloadAssessmentCertificateController = async (
  req: Request,
  res: Response,
) => {
  const userId = res.locals.user.id;
  const resultId = Number(req.params.resultId);

  const certificate = await generateAssessmentCertificateService(
    userId,
    resultId,
  );

  const doc = await generateCertificatePdfService(certificate);

  const filename = `certificate-${certificate.certificateCode}.pdf`;

  res.setHeader("Content-Type", "application/pdf");
  res.setHeader(
    "Content-Disposition",
    `attachment; filename="${filename}"`,
  );

  doc.pipe(res);
  doc.end();
};