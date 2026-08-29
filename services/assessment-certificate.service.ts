import PDFDocument from "pdfkit";
import type { CertificatePdfData } from "../types/assessment-certificate.type.js";

export const generateCertificatePdfService = (
  data: CertificatePdfData,
): PDFKit.PDFDocument => {
  const doc = new PDFDocument({
    size: "A4",
    layout: "landscape",
    margin: 50,
  });

  doc.fontSize(20).text("POLARIS", {
    align: "center",
  });

  doc.moveDown(1.5);

  doc.fontSize(32).text("Certificate of Achievement", {
    align: "center",
  });

  doc.moveDown();

  doc.fontSize(16).text("This certificate is awarded to", {
    align: "center",
  });

  doc.moveDown(0.5);

  doc.fontSize(28).text(data.user.name, {
    align: "center",
  });

  doc.moveDown();

  doc.fontSize(16).text("for successfully completing", {
    align: "center",
  });

  doc.moveDown(0.5);

  doc.fontSize(22).text(data.assessment.title, {
    align: "center",
  });

  doc.moveDown();

  doc.fontSize(16).text(`Skill: ${data.assessment.skillName}`, {
    align: "center",
  });

  doc.fontSize(16).text(`Score: ${data.score}`, {
    align: "center",
  });

  doc.moveDown(1.5);

  doc.fontSize(11).text(`Certificate ID: ${data.certificateCode}`, {
    align: "center",
  });

  doc
    .fontSize(11)
    .text(`Issued: ${data.completedAt.toLocaleDateString("en-GB")}`, {
      align: "center",
    });

  return doc;
};
