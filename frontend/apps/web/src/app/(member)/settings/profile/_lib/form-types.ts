export type DeveloperProfileValues = {
  kind: 'DEVELOPER';
  name: string;
  bio: string;
  blogUrl: string;
  techStack: string[];
  lookingForTeam: boolean;
  jobStatus: 'SEEKING' | 'OPEN' | 'OFF';
  jobCategories: string[];
};

export type RecruiterProfileValues = {
  kind: 'RECRUITER';
  name: string;
  company: string;
  jobTitle: string;
  websiteUrl: string;
  companyEmail: string;
};

export type JobCategory = { key: string; label: string };
export type TechTag = { id: number; name: string };
