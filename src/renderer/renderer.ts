import type { TailoredResume, ContactInfo, Experience, Education, TailoredDocumentSummary } from '../types/index.js';
import { renderResume } from './resume-template.js';
import { renderCoverLetter } from './cover-letter-template.js';

const urlParams = new URLSearchParams(window.location.search);
const documentType = urlParams.get('type') || 'resume';
const requestedTs = Number(urlParams.get('ts') || '0');

/** Normalize stored resume so renderResume never throws (LLM may return skills as object or omit fields). */
function normalizeResume(data: unknown): TailoredResume {
  const r = data as Record<string, unknown>;
  const contact = (r?.contact as ContactInfo) || {};
  const rawSkills = r?.skills;
  const skills: string[] = Array.isArray(rawSkills)
    ? rawSkills.filter((s): s is string => typeof s === 'string')
    : typeof rawSkills === 'object' && rawSkills !== null
      ? Object.values(rawSkills).flat().filter((s): s is string => typeof s === 'string')
      : [];
  const experience = Array.isArray(r?.experience) ? (r.experience as Experience[]) : [];
  const education = Array.isArray(r?.education) ? (r.education as Education[]) : [];
  return {
    contact: {
      name: typeof contact.name === 'string' ? contact.name : 'Candidate',
      location: contact.location,
      email: contact.email,
      phone: contact.phone,
      linkedin: contact.linkedin,
      github: contact.github,
      portfolio: contact.portfolio,
    },
    summary: typeof r?.summary === 'string' ? r.summary : '',
    skills,
    experience,
    education,
    projects: Array.isArray(r?.projects) ? r.projects : undefined,
    certifications: Array.isArray(r?.certifications) ? r.certifications : undefined,
    languages: Array.isArray(r?.languages) ? r.languages : undefined,
    keyAchievements: Array.isArray(r?.keyAchievements) ? r.keyAchievements : undefined,
  };
}

async function getFreshStorage(maxWaitMs: number = 4000) {
  const start = Date.now();
  while (true) {
    const storage = await chrome.storage.local.get([
      'currentResume',
      'currentResumeTs',
      'currentCoverLetter',
      'currentCoverLetterTs',
      'currentJob',
      'lastDocumentMeta',
    ]);

    if (!requestedTs) return storage;

    if (documentType === 'resume') {
      const ts = Number(storage.currentResumeTs || 0);
      if (storage.currentResume && ts >= requestedTs) return storage;
    } else if (documentType === 'cover-letter') {
      const ts = Number(storage.currentCoverLetterTs || 0);
      if (storage.currentCoverLetter && ts >= requestedTs) return storage;
    } else {
      return storage;
    }

    if (Date.now() - start > maxWaitMs) return storage;
    await new Promise((r) => setTimeout(r, 250));
  }
}

async function loadDocument() {
  try {
    const storage = await getFreshStorage();
    
    const container = document.getElementById('document-content');
    if (!container) return;

    const meta = storage.lastDocumentMeta as TailoredDocumentSummary | undefined;
    const root = document.getElementById('root');
    if (root && meta?.length === '1-page') {
      root.classList.add('layout-one-page');
    } else if (root && meta?.length === '2-page') {
      root.classList.add('layout-two-page');
    }

    if (documentType === 'resume' && storage.currentResume) {
      const resume = normalizeResume(storage.currentResume);
      container.innerHTML = renderResume(resume);
      
      // Show copy button only for cover letters
      const copyBtn = document.getElementById('copy-text');
      if (copyBtn) copyBtn.style.display = 'none';
    } else if (documentType === 'cover-letter' && storage.currentCoverLetter) {
      const coverLetter = storage.currentCoverLetter as string;
      const job = storage.currentJob;
      container.innerHTML = renderCoverLetter(coverLetter, job);
      
      // Show copy button for cover letters
      const copyBtn = document.getElementById('copy-text');
      if (copyBtn) copyBtn.style.display = 'inline-block';
    } else {
      container.innerHTML = '<p>No document data found.</p>';
    }
  } catch (error) {
    console.error('Failed to load document:', error);
    const container = document.getElementById('document-content');
    if (container) {
      container.innerHTML = '<p>Error loading document.</p>';
    }
  }
}

function downloadPDF() {
  window.print();
}

function printDocument() {
  window.print();
}

function copyText() {
  const content = document.getElementById('document-content');
  if (!content) return;

  const text = content.innerText || content.textContent || '';
  navigator.clipboard.writeText(text).then(() => {
    const btn = document.getElementById('copy-text');
    if (btn) {
      const originalText = btn.textContent;
      btn.textContent = 'Copied!';
      setTimeout(() => {
        if (btn) btn.textContent = originalText;
      }, 2000);
    }
  }).catch(err => {
    console.error('Failed to copy text:', err);
    alert('Failed to copy text to clipboard');
  });
}

// Event listeners
document.addEventListener('DOMContentLoaded', () => {
  loadDocument();
  
  document.getElementById('download-pdf')?.addEventListener('click', downloadPDF);
  document.getElementById('print')?.addEventListener('click', printDocument);
  document.getElementById('copy-text')?.addEventListener('click', copyText);
});
