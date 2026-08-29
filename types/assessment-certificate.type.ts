export type CertificatePdfData = {
  certificateCode: string;
  user: {
    id: number;
    name: string;
  };
  assessment: {
    id: number;
    skillName: string;
    title: string;
  };
  score: number;
  completedAt: Date;
};