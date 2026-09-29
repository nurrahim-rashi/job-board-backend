import PDFDocument from "pdfkit";
import { fileURLToPath } from "node:url";
import { prisma } from "../lib/prisma.js";
import { ApiError } from "../utils/api-error.js";
import { checkActiveSubscription } from "../helpers/subscription.helper.js";
import type { CvPdfData, GenerateCvInput } from "../types/cv.type.js";

export const getCvDataService = async (
  userId: number,
  data: GenerateCvInput,
): Promise<CvPdfData> => {
  await checkActiveSubscription(userId);

  const user = await prisma.user.findUnique({
    where: {
      id: userId,
    },
    select: {
      name: true,
      email: true,
      city: true,
      province: true,
      country: true,
    },
  });

  if (!user) {
    throw new ApiError("User not found", 404);
  }

  return {
    ...data,
    user,
  };
};

const interRegularPath = fileURLToPath(
  new URL("../assets/fonts/Inter-Regular.ttf", import.meta.url),
);

const interBoldPath = fileURLToPath(
  new URL("../assets/fonts/Inter-Bold.ttf", import.meta.url),
);

export const generateCvPdfService = (data: CvPdfData): PDFKit.PDFDocument => {
  const doc = new PDFDocument({
    size: "A4",
    margin: 42,
    font: interRegularPath,
  });

  const contentWidth =
    doc.page.width - doc.page.margins.left - doc.page.margins.right;

  const sectionHeading = (heading: string) => {
    doc.moveDown(0.65);

    doc
      .font(interBoldPath)
      .fontSize(10)
      .fillColor("#111111")
      .text(heading.toUpperCase());

    const lineY = doc.y + 2;

    doc
      .strokeColor("#555555")
      .lineWidth(0.7)
      .moveTo(doc.page.margins.left, lineY)
      .lineTo(doc.page.width - doc.page.margins.right, lineY)
      .stroke();

    doc.y = lineY + 6;
  };

  const rightAlignedText = (text: string, y: number) => {
    doc
      .font(interRegularPath)
      .fontSize(9)
      .fillColor("#222222")
      .text(text, doc.page.margins.left, y, {
        width: contentWidth,
        align: "right",
        lineBreak: false,
      });
  };

  // Header
  doc
    .font(interBoldPath)
    .fontSize(18)
    .fillColor("#111111")
    .text(data.user.name.toUpperCase(), {
      align: "center",
    });

  doc.moveDown(0.15);

  const location = [
    data.user.city,
    data.user.province,
    data.user.country,
  ]
    .filter(Boolean)
    .join(", ");

  const contactDetails = [
    location,
    data.phone,
    data.user.email,
  ].filter(Boolean);

  doc
    .font(interRegularPath)
    .fontSize(8.5)
    .fillColor("#222222")
    .text(contactDetails.join(" | "), {
      align: "center",
    });

  // Professional summary
  sectionHeading("Professional Summary");

  doc
    .font(interRegularPath)
    .fontSize(9.5)
    .fillColor("#111111")
    .text(data.professionalSummary, {
      align: "left",
      lineGap: 1,
    });

  // Skills
  sectionHeading("Skills");

  doc
    .font(interRegularPath)
    .fontSize(9.5)
    .text(data.skills.join(", "), {
      lineGap: 1,
    });

  // Work experience
  if (data.workExperiences.length > 0) {
    sectionHeading("Work Experience");

    for (const experience of data.workExperiences) {
      const entryY = doc.y;

      const period = experience.isCurrent
        ? `${experience.startDate} - Present`
        : `${experience.startDate} - ${experience.endDate ?? ""}`;

      doc
        .font(interBoldPath)
        .fontSize(10)
        .text(experience.jobTitle, doc.page.margins.left, entryY, {
          width: contentWidth * 0.7,
        });

      rightAlignedText(period, entryY);

      doc
        .font(interRegularPath)
        .fontSize(9)
        .text(experience.company);

      doc.moveDown(0.15);

      doc
        .font(interRegularPath)
        .fontSize(9)
        .text(experience.description, {
          lineGap: 1,
        });

      doc.moveDown(0.35);
    }
  }

  // Education
  if (data.educations.length > 0) {
    sectionHeading("Education");

    for (const education of data.educations) {
      const entryY = doc.y;

      const educationPeriod = [education.startYear, education.endYear]
        .filter(Boolean)
        .join(" - ");

      doc
        .font(interBoldPath)
        .fontSize(10)
        .text(education.institution, doc.page.margins.left, entryY, {
          width: contentWidth * 0.7,
        });

      if (educationPeriod) {
        rightAlignedText(educationPeriod, entryY);
      }

      const degreeText = [education.degree, education.fieldOfStudy]
        .filter(Boolean)
        .join(" | ");

      doc
        .font(interRegularPath)
        .fontSize(9)
        .text(degreeText);

      doc.moveDown(0.35);
    }
  }

  // Projects
  if (data.projects?.length) {
    sectionHeading("Projects");

    for (const project of data.projects) {
      doc
        .font(interBoldPath)
        .fontSize(10)
        .text(project.name);

      doc
        .font(interRegularPath)
        .fontSize(9)
        .text(project.description, {
          lineGap: 1,
        });

      if (project.technologies?.length) {
        doc
          .font(interRegularPath)
          .fontSize(8.5)
          .text(`Technologies: ${project.technologies.join(", ")}`);
      }

      doc.moveDown(0.35);
    }
  }

  // Languages
  if (data.languages?.length) {
    sectionHeading("Languages");

    const languageText = data.languages
      .map((language) =>
        language.proficiency
          ? `${language.language} - ${language.proficiency}`
          : language.language,
      )
      .join(" | ");

    doc
      .font(interRegularPath)
      .fontSize(9)
      .text(languageText);
  }

  return doc;
};
