export interface CvWorkExperience {
  jobTitle: string;
  company: string;
  startDate: string;
  endDate?: string;
  isCurrent: boolean;
  description: string;
}

export interface CvEducation {
  institution: string;
  degree: string;
  fieldOfStudy?: string;
  startYear?: number;
  endYear?: number;
}

export interface CvProject {
  name: string;
  description: string;
  technologies?: string[];
}

export interface CvLanguage {
  language: string;
  proficiency?: string;
}

export interface GenerateCvInput {
  professionalSummary: string;
  phone?: string;
  skills: string[];
  workExperiences: CvWorkExperience[];
  educations: CvEducation[];
  projects?: CvProject[];
  languages?: CvLanguage[];
}

export interface CvPdfData extends GenerateCvInput {
  user: {
    name: string;
    email: string;
    city: string | null;
    province: string | null;
  };
}