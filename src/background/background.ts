// Background service worker for state management

import type { JobData, CandidateProfile, TailoredResume, GenerationOptions } from '../types/index.js';

// Use fetch API directly for Groq (more reliable in service workers)
async function callGroqAPI(messages: Array<{ role: string; content: string }>, apiKey: string, model: string = 'llama-3.1-70b-versatile') {
  const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model,
      messages,
      temperature: 0.7,
      max_tokens: 4096,
      top_p: 1,
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Groq API error: ${response.status} - ${error}`);
  }

  const data = await response.json();
  return data.choices[0]?.message?.content || '';
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

  // Use Groq if API key is available, otherwise fall back to rule-based
  if (apiKey) {
    return await tailorResumeWithGroq(profile, jobData, options, apiKey);
  } else {
    return tailorResume(profile, jobData, options);
  }
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

  // Use Groq if API key is available, otherwise fall back to rule-based
  if (apiKey) {
    return await tailorCoverLetterWithGroq(profile, jobData, options, apiKey);
  } else {
    return tailorCoverLetter(profile, jobData, options);
  }
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
    ? 'I look forward to the opportunity to discuss how my experience aligns with your needs.\n\nSincerely,\n' + profile.contact.name
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
    // Prepare profile data as JSON string
    const profileJson = JSON.stringify(profile, null, 2);
    
    const prompt = `You are an expert ATS (Applicant Tracking System) resume optimizer. Generate a tailored resume based on the candidate's profile and job description.

CANDIDATE PROFILE (JSON):
${profileJson}

JOB POSTING:
Title: ${job.title}
Company: ${job.company}
Location: ${job.location}
Description: ${job.description.substring(0, 2000)}${job.description.length > 2000 ? '...' : ''}

GENERATION OPTIONS:
- Tone: ${options.tone}
- Emphasis: ${options.emphasis}
- Length: ${options.length}

REQUIREMENTS:
1. Generate an ATS-friendly resume that matches the job description
2. Reorder and emphasize skills that match the job requirements
3. Rewrite experience bullets to align with job keywords (DO NOT invent fake experiences - only rephrase existing ones)
4. Create a tailored summary (5-6 lines) that highlights relevant experience
5. Extract key achievements if applicable
6. Keep all information factual - do not add fake employers, dates, or achievements
7. Output format: Valid JSON matching this structure:
{
  "contact": { "name": "...", "location": "...", "email": "...", "phone": "...", "linkedin": "...", "github": "...", "portfolio": "..." },
  "summary": "...",
  "skills": ["skill1", "skill2", ...],
  "experience": [
    {
      "company": "...",
      "role": "...",
      "location": "...",
      "startDate": "...",
      "endDate": "...",
      "bullets": ["bullet1", "bullet2", ...]
    }
  ],
  "projects": [...],
  "education": [...],
  "certifications": [...],
  "languages": [...],
  "keyAchievements": ["achievement1", "achievement2", ...]
}

Return ONLY valid JSON, no markdown, no code blocks, no explanations.`;

    const responseText = await callGroqAPI(
      [{ role: 'user', content: prompt }],
      apiKey,
      'llama-3.1-70b-versatile'
    );
    
    // Parse JSON response (remove markdown code blocks if present)
    let jsonText = responseText.trim();
    if (jsonText.startsWith('```json')) {
      jsonText = jsonText.replace(/```json\n?/g, '').replace(/```\n?/g, '');
    } else if (jsonText.startsWith('```')) {
      jsonText = jsonText.replace(/```\n?/g, '');
    }
    
    const tailoredResume = JSON.parse(jsonText) as TailoredResume;
    
    // Ensure contact info is preserved
    tailoredResume.contact = profile.contact;
    
    return tailoredResume;
  } catch (error: any) {
    console.error('Groq API error:', error);
    // Fall back to rule-based generation
    console.log('Falling back to rule-based generation');
    return tailorResume(profile, job, options);
  }
}

async function tailorCoverLetterWithGroq(
  profile: CandidateProfile,
  job: StoredJobData,
  options: GenerationOptions,
  apiKey: string
): Promise<string> {
  try {
    const prompt = `You are an expert cover letter writer. Generate a tailored cover letter based on the candidate's profile and job description.

CANDIDATE PROFILE:
Name: ${profile.contact.name}
Summary: ${profile.summary}
Most Recent Role: ${profile.experience[0]?.role || 'N/A'} at ${profile.experience[0]?.company || 'N/A'}
Key Skills: ${Object.values(profile.skills).flat().slice(0, 10).join(', ')}

JOB POSTING:
Title: ${job.title}
Company: ${job.company}
Location: ${job.location}
Description: ${job.description.substring(0, 2000)}${job.description.length > 2000 ? '...' : ''}

GENERATION OPTIONS:
- Tone: ${options.tone === 'formal' ? 'Formal and professional' : 'Professional but friendly'}
- Emphasis: ${options.emphasis}

REQUIREMENTS:
1. Write a compelling cover letter (3-4 paragraphs)
2. Address the hiring manager professionally
3. Highlight relevant experience and skills from the candidate's profile
4. Show enthusiasm for the role and company
5. Keep it factual - only mention real experiences from the profile
6. Match the tone specified
7. End with a professional closing and the candidate's name

Return the cover letter text only, no markdown formatting, no code blocks.`;

    const coverLetter = await callGroqAPI(
      [{ role: 'user', content: prompt }],
      apiKey,
      'llama-3.1-70b-versatile'
    );
    
    // Clean up response (remove markdown if present)
    let cleaned = coverLetter.trim();
    if (cleaned.startsWith('```')) {
      cleaned = cleaned.replace(/```[a-z]*\n?/g, '').replace(/```\n?/g, '');
    }
    
    return cleaned;
  } catch (error: any) {
    console.error('Groq API error:', error);
    // Fall back to rule-based generation
    console.log('Falling back to rule-based generation');
    return tailorCoverLetter(profile, job, options);
  }
}
