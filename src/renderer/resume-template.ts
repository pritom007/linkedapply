import type { TailoredResume } from '../types/index.js';

export function renderResume(resume: TailoredResume): string {
  const contact = resume.contact ?? { name: 'Candidate' };
  const summary = typeof resume.summary === 'string' ? resume.summary : '';
  const skills = Array.isArray(resume.skills) ? resume.skills : [];
  const experience = Array.isArray(resume.experience) ? resume.experience : [];
  const education = Array.isArray(resume.education) ? resume.education : [];
  return `
    <div class="resume">
      ${renderHeader(contact)}
      ${renderSummary(summary)}
      ${resume.keyAchievements?.length ? renderKeyAchievements(resume.keyAchievements) : ''}
      ${renderSkills(skills)}
      ${renderExperience(experience)}
      ${resume.projects?.length ? renderProjects(resume.projects) : ''}
      ${renderEducation(education)}
      ${resume.certifications?.length ? renderCertifications(resume.certifications) : ''}
      ${resume.languages?.length ? renderLanguages(resume.languages) : ''}
    </div>
  `;
}

function renderHeader(contact: TailoredResume['contact']): string {
  const contactItems: string[] = [];
  if (contact.location) contactItems.push(contact.location);
  if (contact.email) contactItems.push(contact.email);
  if (contact.phone) contactItems.push(contact.phone);
  if (contact.linkedin) contactItems.push(`LinkedIn: ${contact.linkedin}`);
  if (contact.github) contactItems.push(`GitHub: ${contact.github}`);
  if (contact.portfolio) contactItems.push(`Portfolio: ${contact.portfolio}`);

  return `
    <div class="resume-header">
      <div class="resume-name">${escapeHtml(contact.name)}</div>
      <div class="resume-contact">
        ${contactItems.map(item => `<span>${escapeHtml(item)}</span>`).join('')}
      </div>
    </div>
  `;
}

function renderSummary(summary: string): string {
  return `
    <div class="resume-section">
      <div class="resume-section-title">Summary</div>
      <div class="resume-summary">${escapeHtml(summary)}</div>
    </div>
  `;
}

function renderKeyAchievements(achievements: string[]): string {
  return `
    <div class="resume-section">
      <div class="resume-section-title">Key Achievements</div>
      <div class="resume-key-achievements">
        ${achievements.map(achievement => `
          <div class="resume-key-achievements-item">${escapeHtml(achievement)}</div>
        `).join('')}
      </div>
    </div>
  `;
}

function renderSkills(skills: string[]): string {
  return `
    <div class="resume-section">
      <div class="resume-section-title">Skills</div>
      <div class="resume-skills">
        ${skills.map(skill => `<span class="resume-skill">${escapeHtml(skill)}</span>`).join('')}
      </div>
    </div>
  `;
}

function renderExperience(experience: TailoredResume['experience']): string {
  const getBullets = (exp: { bullets?: string[] }) => Array.isArray(exp?.bullets) ? exp.bullets : [];
  return `
    <div class="resume-section">
      <div class="resume-section-title">Experience</div>
      ${experience.map(exp => `
        <div class="resume-experience-item">
          <div class="resume-experience-header">
            <div>
              <div class="resume-role">${escapeHtml(exp?.role ?? '')}</div>
              <div class="resume-company">${escapeHtml(exp?.company ?? '')}${exp?.location ? ` • ${escapeHtml(exp.location)}` : ''}</div>
            </div>
            <div class="resume-date">${formatDate(exp?.startDate ?? '')} – ${exp?.endDate === 'Present' ? 'Present' : formatDate(exp?.endDate ?? '')}</div>
          </div>
          <ul class="resume-bullets">
            ${getBullets(exp).map(bullet => `<li>${escapeHtml(bullet)}</li>`).join('')}
          </ul>
        </div>
      `).join('')}
    </div>
  `;
}

function renderProjects(projects: TailoredResume['projects']): string {
  if (!projects || projects.length === 0) return '';
  
  return `
    <div class="resume-section">
      <div class="resume-section-title">Projects</div>
      ${projects.map(project => `
        <div class="resume-experience-item">
          <div class="resume-experience-header">
            <div>
              <div class="resume-role">${escapeHtml(project.name)}</div>
              ${project.url ? `<div class="resume-company">${escapeHtml(project.url)}</div>` : ''}
            </div>
          </div>
          <div class="resume-summary">${escapeHtml(project.description)}</div>
          ${project.technologies.length > 0 ? `
            <div class="resume-skills" style="margin-top: 8px;">
              ${project.technologies.map(tech => `<span class="resume-skill">${escapeHtml(tech)}</span>`).join('')}
            </div>
          ` : ''}
        </div>
      `).join('')}
    </div>
  `;
}

function renderEducation(education: TailoredResume['education']): string {
  return `
    <div class="resume-section">
      <div class="resume-section-title">Education</div>
      ${education.map(edu => `
        <div class="resume-education-item">
          <div class="resume-education-header">
            <div>
              <div class="resume-degree">${escapeHtml(edu.degree)}${edu.field ? ` in ${escapeHtml(edu.field)}` : ''}</div>
              <div class="resume-institution">${escapeHtml(edu.institution)}</div>
            </div>
            <div class="resume-date">${formatDate(edu.startDate)} – ${formatDate(edu.endDate)}</div>
          </div>
          ${edu.gpa ? `<div style="margin-top: 4px; font-size: 10pt; color: #666;">GPA: ${escapeHtml(edu.gpa)}</div>` : ''}
        </div>
      `).join('')}
    </div>
  `;
}

function renderCertifications(certifications: TailoredResume['certifications']): string {
  if (!certifications || certifications.length === 0) return '';
  
  return `
    <div class="resume-section">
      <div class="resume-section-title">Certifications</div>
      ${certifications.map(cert => `
        <div class="resume-experience-item">
          <div class="resume-experience-header">
            <div>
              <div class="resume-role">${escapeHtml(cert.name)}</div>
              <div class="resume-company">${escapeHtml(cert.issuer)}</div>
            </div>
            <div class="resume-date">${formatDate(cert.date)}${cert.expiryDate ? ` – ${formatDate(cert.expiryDate)}` : ''}</div>
          </div>
          ${cert.credentialId ? `<div style="margin-top: 4px; font-size: 10pt; color: #666;">Credential ID: ${escapeHtml(cert.credentialId)}</div>` : ''}
        </div>
      `).join('')}
    </div>
  `;
}

function renderLanguages(languages: TailoredResume['languages']): string {
  if (!languages || languages.length === 0) return '';
  
  return `
    <div class="resume-section">
      <div class="resume-section-title">Languages</div>
      <div class="resume-skills">
        ${languages.map(lang => `<span class="resume-skill">${escapeHtml(lang.language)} (${escapeHtml(lang.proficiency)})</span>`).join('')}
      </div>
    </div>
  `;
}

function formatDate(date: string): string {
  // Try to format dates consistently (e.g., "May 2022")
  // If already formatted, return as-is
  return date;
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
