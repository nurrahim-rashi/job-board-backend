import PDFDocument from "pdfkit";
import QRCode from "qrcode";
import { fileURLToPath } from "node:url";
import type { CertificatePdfData } from "../types/assessment-certificate.type.js";

const interRegularPath = fileURLToPath(
  new URL("../assets/fonts/Inter-Regular.ttf", import.meta.url),
);

export const generateCertificatePdfService = async (
  data: CertificatePdfData,
): Promise<PDFKit.PDFDocument> => {
  const doc = new PDFDocument({
    size: "A4",
    layout: "landscape",
    margin: 50,
    font: interRegularPath,
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

  const pageWidth = doc.page.width;
  const pageHeight = doc.page.height;
  const accentColor = "#485eb4";

  // Decorative corner accents
  doc
    .strokeColor(accentColor)
    .lineWidth(4)
    .moveTo(34, 74)
    .lineTo(34, 34)
    .lineTo(74, 34)
    .stroke();

  doc
    .moveTo(pageWidth - 74, 34)
    .lineTo(pageWidth - 34, 34)
    .lineTo(pageWidth - 34, 74)
    .stroke();

  doc
    .moveTo(34, pageHeight - 74)
    .lineTo(34, pageHeight - 34)
    .lineTo(74, pageHeight - 34)
    .stroke();

  doc
    .moveTo(pageWidth - 74, pageHeight - 34)
    .lineTo(pageWidth - 34, pageHeight - 34)
    .lineTo(pageWidth - 34, pageHeight - 74)
    .stroke();

  // Header
  doc.fillColor("#111111").fontSize(18).text("POLARIS", {
    align: "center",
  });

  const accentWidth = 54;
  const accentX = (pageWidth - accentWidth) / 2;

  doc
    .strokeColor(accentColor)
    .lineWidth(2)
    .moveTo(accentX, doc.y + 5)
    .lineTo(accentX + accentWidth, doc.y + 5)
    .stroke();

  doc.moveDown(1.2);

  doc.fontSize(30).text("Certificate of Achievement", {
    align: "center",
  });

  doc.moveDown(0.8);

  doc.fontSize(15).text("This certificate is awarded to", {
    align: "center",
  });

  doc.moveDown(0.35);

  doc.fontSize(27).text(data.user.name, {
    align: "center",
  });

  doc.moveDown(0.7);

  doc.fontSize(15).text("for successfully completing", {
    align: "center",
  });

  doc.moveDown(0.35);

  doc.fontSize(21).text(data.assessment.title, {
    align: "center",
  });

  doc.moveDown(0.65);

  doc.fontSize(14).text(`Skill: ${data.assessment.skillName}`, {
    align: "center",
  });

  doc.fontSize(14).text(`Score: ${data.score}`, {
    align: "center",
  });

  // Fixed metadata and QR area to prevent overlap
  const metadataY = 410;

  doc
    .fillColor("#333333")
    .fontSize(9)
    .text(`Certificate ID: ${data.certificateCode}`, 100, metadataY, {
      align: "center",
      width: pageWidth - 200,
    });

  doc
    .fontSize(9)
    .text(
      `Issued: ${data.completedAt.toLocaleDateString("en-GB")}`,
      100,
      metadataY + 15,
      {
        align: "center",
        width: pageWidth - 200,
      },
    );

  const qrSize = 82;
  const qrX = (pageWidth - qrSize) / 2;
  const qrY = metadataY + 36;

  doc.image(qrCodeBuffer, qrX, qrY, {
    width: qrSize,
  });

  doc
    .fillColor("#555555")
    .fontSize(8)
    .text("Scan to verify this certificate", 100, qrY + qrSize + 6, {
      align: "center",
      width: pageWidth - 200,
      lineBreak: false,
    });

  return doc;
};
