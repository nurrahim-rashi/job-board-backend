import PDFDocument from "pdfkit";
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

export const generateCvPdfService = (data: CvPdfData): PDFKit.PDFDocument => {
  const doc = new PDFDocument({
    size: "A4",
    margin: 50,
  });

  const sectionHeading = (heading: string) => {
    doc.moveDown();
    doc.font("Helvetica-Bold").fontSize(12).text(heading.toUpperCase());
    doc.moveDown(0.35);
  };

  // Header
  doc.font("Helvetica-Bold").fontSize(22).text(data.user.name);

  doc.moveDown(0.25);

  const contactDetails = [
    data.user.email,
    data.phone,
    [data.user.city, data.user.province].filter(Boolean).join(", "),
  ].filter(Boolean);

  doc.font("Helvetica").fontSize(10).text(contactDetails.join(" | "));

  // Professional summary
  sectionHeading("Professional Summary");

  doc.font("Helvetica").fontSize(10).text(data.professionalSummary, {
    align: "left",
  });

  // Skills
  sectionHeading("Skills");

  doc.font("Helvetica").fontSize(10).text(data.skills.join(", "));

  // Work experience
  if (data.workExperiences.length > 0) {
    sectionHeading("Work Experience");

    for (const experience of data.workExperiences) {
      doc.font("Helvetica-Bold").fontSize(11).text(experience.jobTitle);

      doc.font("Helvetica").fontSize(10).text(experience.company);

      const period = experience.isCurrent
        ? `${experience.startDate} - Present`
        : `${experience.startDate} - ${experience.endDate}`;

      doc.fontSize(9).text(period);

      doc.moveDown(0.25);

      doc.font("Helvetica").fontSize(10).text(experience.description);

      doc.moveDown(0.5);
    }
  }

  // Education
  sectionHeading("Education");

  for (const education of data.educations) {
    doc.font("Helvetica-Bold").fontSize(11).text(education.degree);

    const educationDetail = [education.institution, education.fieldOfStudy]
      .filter(Boolean)
      .join(" | ");

    doc.font("Helvetica").fontSize(10).text(educationDetail);

    if (education.startYear || education.endYear) {
      const educationPeriod = [education.startYear, education.endYear]
        .filter(Boolean)
        .join(" - ");

      doc.fontSize(9).text(educationPeriod);
    }

    doc.moveDown(0.5);
  }

  // Projects
  if (data.projects?.length) {
    sectionHeading("Projects");

    for (const project of data.projects) {
      doc.font("Helvetica-Bold").fontSize(11).text(project.name);

      doc.font("Helvetica").fontSize(10).text(project.description);

      if (project.technologies?.length) {
        doc
          .fontSize(9)
          .text(`Technologies: ${project.technologies.join(", ")}`);
      }

      doc.moveDown(0.5);
    }
  }

  // Languages
  if (data.languages?.length) {
    sectionHeading("Languages");

    for (const language of data.languages) {
      const languageText = language.proficiency
        ? `${language.language} - ${language.proficiency}`
        : language.language;

      doc.font("Helvetica").fontSize(10).text(languageText);
    }
  }

  return doc;
};
