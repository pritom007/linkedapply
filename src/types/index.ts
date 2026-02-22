export interface JobData {
  title: string;
  company: string;
  location: string;
  remoteType?: 'remote' | 'hybrid' | 'onsite';
  description: string;
  employmentType?: string;
  seniority?: string;
  url: string;
  extractedAt: string;
}

export interface ContactInfo {
  name: string;
  location?: string;
  email?: string;
  phone?: string;
  linkedin?: string;
  github?: string;
  portfolio?: string;
}

export interface Experience {
  company: string;
  role: string;
  location?: string;
  startDate: string;
  endDate: string | 'Present';
  bullets: string[];
}

export interface Project {
  name: string;
  description: string;
  technologies: string[];
  url?: string;
}

export interface Education {
  institution: string;
  degree: string;
  field?: string;
  startDate: string;
  endDate: string;
  gpa?: string;
}

export interface Certification {
  name: string;
  issuer: string;
  date: string;
  expiryDate?: string;
  credentialId?: string;
}

export interface CandidateProfile {
  contact: ContactInfo;
  summary: string;
  skills: {
    [category: string]: string[];
  };
  experience: Experience[];
  projects?: Project[];
  education: Education[];
  certifications?: Certification[];
  languages?: {
    language: string;
    proficiency: string;
  }[];
}

export interface TailoredContent {
  summary: string;
  skills: string[];
  experience: Experience[];
  keyAchievements?: string[];
}

export interface GenerationOptions {
  tone: 'formal' | 'neutral';
  emphasis: 'automation' | 'api' | 'performance' | 'leadership' | 'none';
  length: '1-page' | '2-page';
}

export interface TailoredResume {
  contact: ContactInfo;
  summary: string;
  skills: string[];
  experience: Experience[];
  projects?: Project[];
  education: Education[];
  certifications?: Certification[];
  languages?: {
    language: string;
    proficiency: string;
  }[];
  keyAchievements?: string[];
}
