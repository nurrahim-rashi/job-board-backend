import fs from "fs";
import path from "path";
import { ApiError } from "./api-error.js";

const CV_DIRECTORY = "uploads/cvs";

export const calculateAge = (birthDate: Date | null): number | null => {
  if (!birthDate) {
    return null;
  }

  const today = new Date();
  let age = today.getFullYear() - birthDate.getFullYear();
  const monthGap = today.getMonth() - birthDate.getMonth();

  if (monthGap < 0 || (monthGap === 0 && today.getDate() < birthDate.getDate())) {
    age--;
  }

  return age;
};

const yearsAgo = (years: number): Date => {
  const date = new Date();
  date.setFullYear(date.getFullYear() - years);

  return date;
};

/**
 * Age is stored as birthDate, so the filter is flipped:
 * the older the applicant, the earlier the birthDate.
 */
export const buildBirthDateFilter = (minAge?: number, maxAge?: number) => {
  if (minAge === undefined && maxAge === undefined) {
    return undefined;
  }

  return {
    ...(minAge !== undefined && { lte: yearsAgo(minAge) }),
    ...(maxAge !== undefined && { gt: yearsAgo(maxAge + 1) }),
  };
};

export const resolveCvPath = (cvFile: string): string => {
  const filePath = path.resolve(CV_DIRECTORY, path.basename(cvFile));

  if (!fs.existsSync(filePath)) {
    throw new ApiError("CV document is no longer available", 404);
  }

  return filePath;
};
