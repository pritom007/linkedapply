import type { JobData } from '../types/index.js';

export function renderCoverLetter(content: string, job?: JobData): string {
  const paragraphs = content.split('\n\n').filter(p => p.trim().length > 0);
  const today = new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });

  return `
    <div class="cover-letter">
      <div class="cover-letter-header">
        <div class="cover-letter-date">${today}</div>
        ${job ? `
          <div>${escapeHtml(job.company)}</div>
          <div>${escapeHtml(job.location)}</div>
        ` : ''}
      </div>
      
      <div class="cover-letter-body">
        ${paragraphs.map(paragraph => `
          <div class="cover-letter-paragraph">${escapeHtml(paragraph)}</div>
        `).join('')}
      </div>
    </div>
  `;
}

function escapeHtml(text: string): string {
  if (!text) return '';
  const map: { [key: string]: string } = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#039;',
  };
  return text.replace(/[&<>"']/g, (m) => map[m]);
}
