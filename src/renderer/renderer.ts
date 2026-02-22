import type { TailoredResume } from '../types/index.js';
import { renderResume } from './resume-template.js';
import { renderCoverLetter } from './cover-letter-template.js';

const urlParams = new URLSearchParams(window.location.search);
const documentType = urlParams.get('type') || 'resume';

async function loadDocument() {
  try {
    const storage = await chrome.storage.local.get(['currentResume', 'currentCoverLetter', 'currentJob']);
    
    const container = document.getElementById('document-content');
    if (!container) return;

    if (documentType === 'resume' && storage.currentResume) {
      const resume = storage.currentResume as TailoredResume;
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
