import type { JobData } from '../types/index.js';

export function renderCoverLetter(content: string, job?: JobData): string {
  const paragraphs = content.split('\n\n').filter(p => p.trim().length > 0);
  return `
    <div class="cover-letter">
      <div class="cover-letter-header">
        ${job ? `
        <div class="cover-letter-company">${escapeHtml(job.company)}</div>
        <div class="cover-letter-location">${escapeHtml(job.location)}</div>
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

function escapeHtml(text: unknown): string {
  if (text === null || text === undefined) return '';
  const value = typeof text === 'string' ? text : String(text);
  if (!value) return '';
  const map: { [key: string]: string } = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#039;',
  };
  return value.replace(/[&<>"']/g, (m) => map[m]);
}
