// Background service worker for state management

import type { JobData, CandidateProfile, TailoredResume, GenerationOptions } from '../types/index.js';
import { callGroqAPI } from './groq-api.js';

function stripCodeFences(s: string): string {
  let out = s.trim();
  if (out.startsWith('```')) {
    out = out.replace(/^```[a-zA-Z0-9_-]*\n?/, '').replace(/```$/m, '').trim();
  }
  return out;
}

function extractFirstJsonObject(text: string): string | null {
  const s = stripCodeFences(text);
  const start = s.indexOf('{');
  if (start === -1) return null;
  let depth = 0;
  let inString = false;
  let escape = false;
  for (let i = start; i < s.length; i++) {
    const ch = s[i];
    if (inString) {
      if (escape) {
        escape = false;
      } else if (ch === '\\') {
        escape = true;
      } else if (ch === '"') {
        inString = false;
      }
      continue;
    }
    if (ch === '"') {
      inString = true;
      continue;
    }
    if (ch === '{') depth++;
    if (ch === '}') {
      depth--;
      if (depth === 0) return s.slice(start, i + 1);
    }
  }
  return null;
}

interface StoredJobData extends JobData {
  extractedAt: string;
}

// Default candidate profile (for SDET/QA Automation Engineer)
const DEFAULT_PROFILE: CandidateProfile = {
  contact: {
    name: 'Your Name',
    location: 'City, Country',
    email: 'your.email@example.com',
    phone: '+1 (555) 123-4567',
    linkedin: 'linkedin.com/in/yourprofile',
    github: 'github.com/yourusername',
  },
  summary: 'Experienced SDET/QA Automation Engineer with expertise in test automation frameworks, API testing, and CI/CD integration.',
  skills: {
    'Test Automation': ['Selenium', 'Playwright', 'Cypress', 'WebDriverIO'],
    'Programming': ['Python', 'JavaScript', 'TypeScript', 'Java'],
    'API Testing': ['REST Assured', 'Postman', 'Pytest', 'Jest'],
    'CI/CD': ['Jenkins', 'GitHub Actions', 'GitLab CI', 'Docker'],
    'Tools': ['JIRA', 'TestRail', 'Confluence', 'Git'],
  },
  experience: [
    {
      company: 'Tech Company Inc.',
      role: 'Senior SDET',
      location: 'San Francisco, CA',
      startDate: 'Jan 2021',
      endDate: 'Present',
      bullets: [
        'Led automation framework development using Playwright and TypeScript',
        'Reduced test execution time by 60% through parallel execution',
        'Implemented API testing suite covering 200+ endpoints',
      ],
    },
  ],
  education: [
    {
      institution: 'University Name',
      degree: 'Bachelor of Science',
      field: 'Computer Science',
      startDate: '2015',
      endDate: '2019',
    },
  ],
  projects: [],
  certifications: [],
  languages: [],
};

// Initialize storage with default profile if needed
chrome.runtime.onInstalled.addListener(async () => {
  const result = await chrome.storage.local.get('candidateProfile');
  if (!result.candidateProfile) {
    await chrome.storage.local.set({ candidateProfile: DEFAULT_PROFILE });
  }
});

// Listen for job data extraction
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'JOB_DATA_EXTRACTED') {
    const jobData: StoredJobData = {
      ...message.data,
      extractedAt: new Date().toISOString(),
    };
    
    chrome.storage.local.set({ currentJob: jobData }).then(() => {
      console.log('Job data stored:', jobData);
    });
  }

  if (message.type === 'GET_CURRENT_JOB') {
    chrome.storage.local.get('currentJob').then(result => {
      sendResponse({ data: result.currentJob || null });
    });
    return true;
  }

  if (message.type === 'CLEAR_CURRENT_JOB') {
    chrome.storage.local.remove('currentJob').then(() => {
      sendResponse({ success: true });
    });
    return true;
  }

  if (message.type === 'GET_PROFILE') {
    chrome.storage.local.get('candidateProfile').then(result => {
      sendResponse({ data: result.candidateProfile || DEFAULT_PROFILE });
    });
    return true;
  }

  if (message.type === 'SAVE_PROFILE') {
    chrome.storage.local.set({ candidateProfile: message.data }).then(() => {
      sendResponse({ success: true });
    });
    return true;
  }

  if (message.type === 'SAVE_GROQ_API_KEY') {
    chrome.storage.local.set({ groqApiKey: message.apiKey }).then(() => {
      sendResponse({ success: true });
    });
    return true;
  }

  if (message.type === 'GET_GROQ_API_KEY') {
    chrome.storage.local.get('groqApiKey').then(result => {
      sendResponse({ apiKey: result.groqApiKey || null });
    });
    return true;
  }

  if (message.type === 'GENERATE_RESUME') {
    handleGenerateResume(message.options)
      .then(result => sendResponse({ success: true, data: result }))
      .catch(error => sendResponse({ success: false, error: error.message }));
    return true;
  }

  if (message.type === 'GENERATE_COVER_LETTER') {
    handleGenerateCoverLetter(message.options)
      .then(result => sendResponse({ success: true, data: result }))
      .catch(error => sendResponse({ success: false, error: error.message }));
    return true;
  }

  if (message.type === 'PARSE_RESUME_FROM_TEXT') {
    handleParseResumeFromText(message.resumeText)
      .then(profile => sendResponse({ success: true, data: profile }))
      .catch(error => sendResponse({ success: false, error: error?.message ?? String(error) }));
    return true;
  }

  return false;
});

async function handleGenerateResume(options: GenerationOptions): Promise<TailoredResume> {
  const [jobResult, profileResult, apiKeyResult] = await Promise.all([
    chrome.storage.local.get('currentJob'),
    chrome.storage.local.get('candidateProfile'),
    chrome.storage.local.get('groqApiKey'),
  ]);

  const jobData = jobResult.currentJob as StoredJobData | undefined;
  const profile = profileResult.candidateProfile as CandidateProfile || DEFAULT_PROFILE;
  const apiKey = apiKeyResult.groqApiKey as string | undefined;

  if (!jobData) {
    throw new Error('No job data found. Please navigate to a LinkedIn job page.');
  }

  if (!apiKey) {
    throw new Error('Groq API key required for ATS-optimized CV. Add your key in Edit Profile → API Configuration (get a free key at console.groq.com).');
  }

  return await tailorResumeWithGroq(profile, jobData, options, apiKey);
}

async function handleGenerateCoverLetter(options: GenerationOptions): Promise<string> {
  const [jobResult, profileResult, apiKeyResult] = await Promise.all([
    chrome.storage.local.get('currentJob'),
    chrome.storage.local.get('candidateProfile'),
    chrome.storage.local.get('groqApiKey'),
  ]);

  const jobData = jobResult.currentJob as StoredJobData | undefined;
  const profile = profileResult.candidateProfile as CandidateProfile || DEFAULT_PROFILE;
  const apiKey = apiKeyResult.groqApiKey as string | undefined;

  if (!jobData) {
    throw new Error('No job data found. Please navigate to a LinkedIn job page.');
  }

  if (!apiKey) {
    throw new Error('Groq API key required for AI-generated cover letter. Add your key in Edit Profile → API Configuration (get a free key at console.groq.com).');
  }

  return await tailorCoverLetterWithGroq(profile, jobData, options, apiKey);
}

async function handleParseResumeFromText(resumeText: string): Promise<CandidateProfile> {
  const result = await chrome.storage.local.get('groqApiKey');
  const apiKey = result.groqApiKey as string | undefined;
  if (!apiKey?.trim()) {
    throw new Error('Groq API key required. Add your key in API Configuration above.');
  }
  return parseResumeWithGroq(resumeText.trim(), apiKey);
}

async function parseResumeWithGroq(resumeText: string, apiKey: string): Promise<CandidateProfile> {
  const truncated = resumeText.length > 12000 ? resumeText.substring(0, 12000) + '\n...[truncated]' : resumeText;
  const prompt = `You are an expert at extracting structured data from resumes. Parse the following resume text and return a single JSON object with this exact structure. Extract all information you can find. Use empty arrays or omit optional fields when not present.

Required JSON structure (use these keys exactly):
{
  "contact": {
    "name": "string (required)",
    "location": "string or omit",
    "email": "string or omit",
    "phone": "string or omit",
    "linkedin": "string or omit",
    "github": "string or omit",
    "portfolio": "string or omit"
  },
  "summary": "string (professional summary)",
  "skills": {
    "CategoryName": ["skill1", "skill2"],
    "AnotherCategory": ["skillA", "skillB"]
  },
  "experience": [
    {
      "company": "string",
      "role": "string",
      "location": "string or omit",
      "startDate": "string e.g. Jan 2021",
      "endDate": "string or Present",
      "bullets": ["achievement or responsibility", "..."]
    }
  ],
  "education": [
    {
      "institution": "string",
      "degree": "string",
      "field": "string or omit",
      "startDate": "string",
      "endDate": "string",
      "gpa": "string or omit"
    }
  ],
  "projects": [{"name": "string", "description": "string", "technologies": ["string"], "url": "string or omit"}],
  "certifications": [{"name": "string", "issuer": "string", "date": "string", "expiryDate": "string or omit", "credentialId": "string or omit"}],
  "languages": [{"language": "string", "proficiency": "string e.g. Native, Fluent"}]
}

Resume text:
---
${truncated}
---

Return ONLY valid JSON. No markdown, no code fence, no explanation.`;

  const responseText = await callGroqAPI(
    [{ role: 'user', content: prompt }],
    apiKey,
    'meta-llama/llama-4-scout-17b-16e-instruct',
    { temperature: 0.3, max_tokens: 4096 }
  );
  const jsonText = extractFirstJsonObject(responseText) ?? stripCodeFences(responseText);
  const parsed = JSON.parse(jsonText) as Record<string, unknown>;
  const contact = (parsed.contact as CandidateProfile['contact']) ?? {};
  if (!contact.name) contact.name = 'Candidate';
  const profile: CandidateProfile = {
    contact,
    summary: typeof parsed.summary === 'string' ? parsed.summary : '',
    skills: typeof parsed.skills === 'object' && parsed.skills !== null && !Array.isArray(parsed.skills)
      ? (parsed.skills as Record<string, string[]>)
      : { Other: [] },
    experience: Array.isArray(parsed.experience) ? (parsed.experience as CandidateProfile['experience']) : [],
    education: Array.isArray(parsed.education) ? (parsed.education as CandidateProfile['education']) : [],
    projects: Array.isArray(parsed.projects) ? (parsed.projects as CandidateProfile['projects']) : undefined,
    certifications: Array.isArray(parsed.certifications) ? (parsed.certifications as CandidateProfile['certifications']) : undefined,
    languages: Array.isArray(parsed.languages) ? (parsed.languages as CandidateProfile['languages']) : undefined,
  };
  return profile;
}

function tailorResume(
  profile: CandidateProfile,
  job: StoredJobData,
  options: GenerationOptions
): TailoredResume {
  // Extract keywords from job description
  const jobKeywords = extractKeywords(job.description);
  
  // Tailor summary
  const summary = tailorSummary(profile.summary, job, jobKeywords, options);
  
  // Reorder and filter skills based on job keywords
  const skills = tailorSkills(profile.skills, jobKeywords);
  
  // Tailor experience bullets
  const experience = profile.experience.map(exp => ({
    ...exp,
    bullets: exp.bullets.map(bullet => tailorBullet(bullet, jobKeywords, options)),
  }));

  // Extract key achievements if relevant keywords match
  const keyAchievements = extractKeyAchievements(profile, jobKeywords);

  return {
    contact: profile.contact,
    summary,
    skills,
    experience,
    projects: profile.projects,
    education: profile.education,
    certifications: profile.certifications,
    languages: profile.languages,
    keyAchievements: keyAchievements.length > 0 ? keyAchievements : undefined,
  };
}

function tailorCoverLetter(
  profile: CandidateProfile,
  job: StoredJobData,
  options: GenerationOptions
): string {
  const jobKeywords = extractKeywords(job.description);
  const tone = options.tone === 'formal' ? 'formal' : 'professional';
  
  const paragraphs = [
    generateCoverLetterOpening(profile, job, tone),
    generateCoverLetterBody(profile, job, jobKeywords, options),
    generateCoverLetterClosing(profile, job, tone),
  ];

  return paragraphs.join('\n\n');
}

function extractKeywords(text: string): string[] {
  const lowerText = text.toLowerCase();
  const commonTechTerms = [
    'selenium', 'playwright', 'cypress', 'webdriver', 'test automation',
    'api testing', 'rest api', 'graphql', 'postman', 'rest assured',
    'python', 'javascript', 'typescript', 'java', 'c#',
    'ci/cd', 'jenkins', 'github actions', 'gitlab', 'docker', 'kubernetes',
    'agile', 'scrum', 'jira', 'testrail', 'qa', 'quality assurance',
    'performance testing', 'load testing', 'security testing',
    'bdd', 'tdd', 'test framework', 'pytest', 'jest', 'mocha',
  ];

  return commonTechTerms.filter(term => lowerText.includes(term));
}

function tailorSummary(
  originalSummary: string,
  job: StoredJobData,
  keywords: string[],
  options: GenerationOptions
): string {
  // Simple tailoring: emphasize keywords found in job description
  let summary = originalSummary;
  
  // Add emphasis based on options
  if (options.emphasis === 'automation' && !summary.toLowerCase().includes('automation')) {
    summary = summary.replace(/test/i, 'test automation');
  }
  
  if (options.emphasis === 'api' && !summary.toLowerCase().includes('api')) {
    summary = summary + ' Strong background in API testing and integration.';
  }

  // Keep summary concise (5-6 lines max)
  const sentences = summary.split(/[.!?]+/).filter(s => s.trim().length > 0);
  return sentences.slice(0, 6).join('. ').trim() + '.';
}

function tailorSkills(
  skillsByCategory: { [category: string]: string[] },
  keywords: string[]
): string[] {
  const allSkills: string[] = [];
  Object.values(skillsByCategory).forEach(categorySkills => {
    allSkills.push(...categorySkills);
  });

  // Prioritize skills that match keywords
  const prioritized: string[] = [];
  const others: string[] = [];

  allSkills.forEach(skill => {
    const skillLower = skill.toLowerCase();
    if (keywords.some(keyword => skillLower.includes(keyword.toLowerCase()))) {
      prioritized.push(skill);
    } else {
      others.push(skill);
    }
  });

  return [...prioritized, ...others];
}

function tailorBullet(
  bullet: string,
  keywords: string[],
  options: GenerationOptions
): string {
  // Simple keyword alignment: if bullet mentions a keyword, keep it; otherwise try to rephrase slightly
  const bulletLower = bullet.toLowerCase();
  const hasKeyword = keywords.some(keyword => bulletLower.includes(keyword.toLowerCase()));
  
  if (hasKeyword) {
    return bullet; // Keep as-is if it already matches
  }

  // Try to incorporate emphasis keywords if specified
  if (options.emphasis === 'performance' && !bulletLower.includes('performance')) {
    if (bulletLower.includes('reduce') || bulletLower.includes('improve')) {
      return bullet.replace(/(reduce|improve)/i, '$& performance');
    }
  }

  return bullet; // Return original if no changes needed
}

function extractKeyAchievements(
  profile: CandidateProfile,
  keywords: string[]
): string[] {
  const achievements: string[] = [];
  
  // Look for quantifiable achievements in experience bullets
  profile.experience.forEach(exp => {
    exp.bullets.forEach(bullet => {
      const bulletLower = bullet.toLowerCase();
      const hasKeyword = keywords.some(k => bulletLower.includes(k.toLowerCase()));
      const hasNumber = /\d+/.test(bullet);
      
      if (hasKeyword && hasNumber && (bulletLower.includes('reduce') || bulletLower.includes('increase') || bulletLower.includes('%'))) {
        achievements.push(bullet);
      }
    });
  });

  return achievements.slice(0, 3); // Max 3 key achievements
}

function generateCoverLetterOpening(
  profile: CandidateProfile,
  job: StoredJobData,
  tone: string
): string {
  const greeting = tone === 'formal' ? 'Dear Hiring Manager,' : 'Hello,';
  return `${greeting}\n\nI am writing to express my interest in the ${job.title} position at ${job.company}. With my background in ${profile.summary.split('.')[0].toLowerCase()}, I am excited about the opportunity to contribute to your team.`;
}

function generateCoverLetterBody(
  profile: CandidateProfile,
  job: StoredJobData,
  keywords: string[],
  options: GenerationOptions
): string {
  const relevantExp = profile.experience[0]; // Use most recent experience
  const relevantSkills = tailorSkills(profile.skills, keywords).slice(0, 5);
  
  let body = `In my current role as ${relevantExp.role} at ${relevantExp.company}, I have `;
  
  if (options.emphasis === 'automation') {
    body += 'led the development and implementation of comprehensive test automation frameworks, ';
  } else if (options.emphasis === 'api') {
    body += 'specialized in API testing and integration, ensuring robust backend functionality, ';
  } else {
    body += 'gained extensive experience in ';
  }
  
  body += `including ${relevantSkills.slice(0, 3).join(', ')}. `;
  
  body += `I am particularly drawn to ${job.company} because ${job.description.substring(0, 100)}...`;
  
  return body;
}

function generateCoverLetterClosing(
  profile: CandidateProfile,
  job: StoredJobData,
  tone: string
): string {
  const closing = tone === 'formal' 
    ? 'I look forward to the opportunity to discuss how my experience aligns with your needs.\n\nSincerely,\n\n' + profile.contact.name
    : 'I\'d love to discuss how I can contribute to your team.\n\nBest regards,\n' + profile.contact.name;
  
  return closing;
}

async function tailorResumeWithGroq(
  profile: CandidateProfile,
  job: StoredJobData,
  options: GenerationOptions,
  apiKey: string
): Promise<TailoredResume> {
  try {
    const profileJson = JSON.stringify(profile, null, 2);
    const jdText = job.description.length > 6000 ? job.description.substring(0, 6000) + '...' : job.description;

    const prompt = `You are an expert ATS (Applicant Tracking System) resume optimizer. Your task is to optimize the candidate's CV using the JOB DESCRIPTION so that when an ATS scans the resume, it finds all necessary keywords and requirements.

STEP 1 - Analyze the job description: Identify required skills, technologies, qualifications, action verbs, and phrases that ATS systems typically match on.

STEP 2 - Optimize the CV: Rewrite the candidate's content so those keywords appear naturally in:
- Summary: Weave in key terms from the JD (role title, must-have skills, industry terms). Keep 5-6 lines.
- Skills: List skills with JD-matching terms first; include synonyms and tools mentioned in the JD that the candidate has.
- Experience bullets: Rephrase each bullet to include relevant JD keywords and action verbs. Do NOT invent employers, dates, or achievements—only rephrase and align existing facts.
- Key achievements (if applicable): Pull 2-3 quantifiable bullets that best match the JD.
STEP 3 - Consider location and formatting:
- Based on the Job description location, try to fit in candidate's cv. For example, if the job description is for a location in Germany , and the candidate's cv is for a location in UAE , and job descripton needs info about visa status, then since the Candidate qualify for EU blue card/job Vacancy visa, you can mention it.
- Consider CV formatting: if the job description is for a location in Germany the make the CV format according that location.
RULES:
- All information must remain 100% factual. No fake jobs, dates, or accomplishments.
- Preserve contact, education, projects, certifications, languages from the profile.
- Output valid JSON only.

CANDIDATE PROFILE (JSON):
${profileJson}

JOB DESCRIPTION (use this to extract keywords and optimize the CV):
Title: ${job.title}
Company: ${job.company}
Location: ${job.location}

${jdText}

OUTPUT: Valid JSON with this exact structure (no markdown, no code fence):
{"contact":{...},"summary":"...","skills":[],"experience":[],"projects":[],"education":[],"certifications":[],"languages":[],"keyAchievements":[]}`;

    const responseText = await callGroqAPI(
      [{ role: 'user', content: prompt }],
      apiKey,
      'meta-llama/llama-4-scout-17b-16e-instruct'
    );

    const jsonText = extractFirstJsonObject(responseText) ?? stripCodeFences(responseText);
    const tailoredResume = JSON.parse(jsonText) as TailoredResume;
    tailoredResume.contact = profile.contact;
    return tailoredResume;
  } catch (error: any) {
    console.error('Groq resume generation error:', error);
    const msg = typeof error?.message === 'string' ? error.message : String(error);
    throw new Error(`Groq resume generation failed. ${msg}`);
  }
}

// Build a plain-text CV summary from profile (for cover letter context)
function profileToCvText(profile: CandidateProfile): string {
  const lines: string[] = [];
  lines.push(`Name: ${profile.contact.name}`);
  lines.push(`Summary: ${profile.summary}`);
  lines.push('Skills: ' + Object.values(profile.skills).flat().join(', '));
  lines.push('Experience:');
  profile.experience.forEach(exp => {
    lines.push(`  ${exp.role} at ${exp.company} (${exp.startDate} – ${exp.endDate})`);
    exp.bullets.forEach(b => lines.push(`  - ${b}`));
  });
  if (profile.education?.length) {
    lines.push('Education:');
    profile.education.forEach(edu => {
      lines.push(`  ${edu.degree}${edu.field ? ` in ${edu.field}` : ''}, ${edu.institution}`);
    });
  }
  if (profile.projects?.length) {
    lines.push('Projects:');
    profile.projects.forEach(p => lines.push(`  ${p.name}: ${p.description}`));
  }
  return lines.join('\n');
}

async function tailorCoverLetterWithGroq(
  profile: CandidateProfile,
  job: StoredJobData,
  options: GenerationOptions,
  apiKey: string
): Promise<string> {
  try {
    const cvText = profileToCvText(profile);
    const jdText = job.description.length > 4000 ? job.description.substring(0, 4000) + '...' : job.description;
    const today = new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });

    const prompt = `You are an expert cover letter writer. Write a cover letter based ONLY on the JOB DESCRIPTION and the candidate's CV below. The letter must reflect the date it is generated.

TODAY'S DATE (use this as the date of the letter): ${today}

CANDIDATE'S CV (use this as the only source of facts about the candidate):
${cvText}

JOB DESCRIPTION:
Title: ${job.title}
Company: ${job.company}
Location: ${job.location}

${jdText}

INSTRUCTIONS:
1. Write a 2-3 paragraph cover letter that ties the candidate's CV to this specific role and company.
2. Use the exact date above at the top of the letter (e.g. "February 19, 2026" or "19 February 2026").
3. Address the hiring manager professionally. Open with the date, then greeting, then body.
4. In the body: reference specific skills and achievements from the CV that match the JD; show you understand the role; keep everything factual—only mention what is in the CV.
5. Tone: ${options.tone === 'formal' ? 'Formal and professional' : 'Professional but friendly'}.
6. End with a professional closing: write the word "Sincerely," on its own line, then a blank line, then on the next line write only the candidate's full name (${profile.contact.name}). So the last lines must be exactly: Sincerely, [blank line] [full name on new line].
7. Return ONLY the raw cover letter text. No markdown, no code blocks, no labels.`;

    let coverLetter = await callGroqAPI(
      [{ role: 'user', content: prompt }],
      apiKey,
      'meta-llama/llama-4-scout-17b-16e-instruct'
    );
    coverLetter = stripCodeFences(coverLetter);
    // Ensure "Sincerely," then blank line, then name on its own line
    const name = profile.contact.name;
    const sincerelyCommaName = `Sincerely, ${name}`;
    const bestRegardsName = `Best regards, ${name}`;
    if (coverLetter.endsWith(sincerelyCommaName) && !coverLetter.endsWith(`Sincerely,\n\n${name}`)) {
      coverLetter = coverLetter.slice(0, -sincerelyCommaName.length) + `Sincerely,\n\n${name}`;
    } else if (coverLetter.endsWith(bestRegardsName) && !coverLetter.endsWith(`Best regards,\n\n${name}`)) {
      coverLetter = coverLetter.slice(0, -bestRegardsName.length) + `Best regards,\n\n${name}`;
    }
    
    return coverLetter;
  } catch (error: any) {
    console.error('Groq cover letter generation error:', error);
    const msg = typeof error?.message === 'string' ? error.message : String(error);
    throw new Error(`Groq cover letter generation failed. ${msg}`);
  }
}
