import PDFDocument from "pdfkit";
import QRCode from "qrcode";
import type { CertificatePdfData } from "../types/assessment-certificate.type.js";

export const generateCertificatePdfService = async (
  data: CertificatePdfData,
): Promise<PDFKit.PDFDocument> => {
  const doc = new PDFDocument({
    size: "A4",
    layout: "landscape",
    margin: 50,
  });

  const frontendUrl = process.env.FRONTEND_URL ?? "http://localhost:5173";

  const verificationUrl = `${frontendUrl}/verify-certificate/${encodeURIComponent(
    data.certificateCode,
  )}`;

  const qrCodeBuffer = await QRCode.toBuffer(verificationUrl, {
    type: "png",
    width: 180,
    margin: 1,
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

  doc.moveDown();

  const qrSize = 90;
  const qrX = (doc.page.width - qrSize) / 2;

  const bottomMargin = 50;
  const captionGap = 8;
  const captionHeight = 14;

  const maxQrY =
    doc.page.height - bottomMargin - qrSize - captionGap - captionHeight;

  const qrY = Math.min(doc.y + 12, maxQrY);

  doc.image(qrCodeBuffer, qrX, qrY, {
    width: qrSize,
  });

  doc
    .fontSize(9)
    .text("Scan to verify this certificate", 50, qrY + qrSize + captionGap, {
      align: "center",
      width: doc.page.width - 100,
      lineBreak: false,
    });

  return doc;
};
