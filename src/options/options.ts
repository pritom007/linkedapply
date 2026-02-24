import type { CandidateProfile, Experience, Education, Project, Certification } from '../types/index.js';

let profileData: CandidateProfile | null = null;

async function loadProfile() {
  try {
    const response = await chrome.runtime.sendMessage({ type: 'GET_PROFILE' });
    if (response?.data) {
      profileData = response.data;
      populateForm(profileData);
    }
  } catch (error) {
    console.error('Failed to load profile:', error);
    showStatus('Failed to load profile', 'error');
  }
}

async function loadApiKey() {
  try {
    const response = await chrome.runtime.sendMessage({ type: 'GET_GROQ_API_KEY' });
    const input = document.getElementById('groq-api-key') as HTMLInputElement | null;
    const statusEl = document.getElementById('groq-api-status');
    const apiKey = response?.apiKey ?? null;
    if (input && typeof apiKey === 'string') {
      input.value = apiKey;
    }
    if (statusEl) {
      if (apiKey) {
        statusEl.textContent = 'AI mode enabled. Resume and cover letters will use Groq when possible.';
        statusEl.className = 'status-inline success';
      } else {
        statusEl.textContent = 'No API key saved. The extension will use local tailoring only (no external API calls).';
        statusEl.className = 'status-inline';
      }
    }
  } catch (error) {
    console.error('Failed to load API key:', error);
  }
}

async function saveApiKey() {
  const apiKey = (document.getElementById('groq-api-key') as HTMLInputElement).value.trim();
  try {
    const response = await chrome.runtime.sendMessage({
      type: 'SAVE_GROQ_API_KEY',
      apiKey: apiKey || null,
    });
    const statusEl = document.getElementById('groq-api-status');
    if (response?.success) {
      if (statusEl) {
        if (apiKey) {
          statusEl.textContent = 'AI mode enabled. Resume and cover letters will use Groq when possible.';
          statusEl.className = 'status-inline success';
        } else {
          statusEl.textContent = 'API key removed. The extension will now use local tailoring only.';
          statusEl.className = 'status-inline';
        }
      }
      showStatus(apiKey ? 'API key saved successfully!' : 'API key removed', 'success');
    } else {
      showStatus('Failed to save API key', 'error');
    }
  } catch (error) {
    console.error('Failed to save API key:', error);
    showStatus('Failed to save API key', 'error');
  }
}

function populateForm(profile: CandidateProfile) {
  // Contact info
  (document.getElementById('name') as HTMLInputElement).value = profile.contact.name || '';
  (document.getElementById('location') as HTMLInputElement).value = profile.contact.location || '';
  (document.getElementById('email') as HTMLInputElement).value = profile.contact.email || '';
  (document.getElementById('phone') as HTMLInputElement).value = profile.contact.phone || '';
  (document.getElementById('linkedin') as HTMLInputElement).value = profile.contact.linkedin || '';
  (document.getElementById('github') as HTMLInputElement).value = profile.contact.github || '';
  (document.getElementById('portfolio') as HTMLInputElement).value = profile.contact.portfolio || '';

  // Summary
  (document.getElementById('summary') as HTMLTextAreaElement).value = profile.summary || '';

  // Skills
  renderSkills(profile.skills);

  // Experience
  renderExperience(profile.experience);

  // Education
  renderEducation(profile.education);

  // Projects
  renderProjects(profile.projects || []);

  // Certifications
  renderCertifications(profile.certifications || []);
}

function renderSkills(skills: { [category: string]: string[] }) {
  const container = document.getElementById('skills-container');
  if (!container) return;

  container.innerHTML = '';

  Object.entries(skills).forEach(([category, skillList]) => {
    const categoryDiv = document.createElement('div');
    categoryDiv.className = 'skill-category';
    categoryDiv.innerHTML = `
      <div class="skill-category-header">
        <input type="text" class="skill-category-name" value="${escapeHtml(category)}" placeholder="Category name">
        <button type="button" class="btn-remove">Remove</button>
      </div>
      <div class="skills-list" data-category="${escapeHtml(category)}"></div>
      <div class="skill-input-container">
        <input type="text" class="skill-input" placeholder="Add skill">
        <button type="button" class="btn btn-secondary add-skill-btn">Add</button>
      </div>
    `;

    const skillsList = categoryDiv.querySelector('.skills-list') as HTMLElement;
    skillList.forEach(skill => {
      addSkillTag(skillsList, skill);
    });

    // Add skill event
    categoryDiv.querySelector('.add-skill-btn')?.addEventListener('click', () => {
      const input = categoryDiv.querySelector('.skill-input') as HTMLInputElement;
      const skill = input.value.trim();
      if (skill) {
        addSkillTag(skillsList, skill);
        input.value = '';
      }
    });

    // Remove category
    categoryDiv.querySelector('.btn-remove')?.addEventListener('click', () => {
      categoryDiv.remove();
    });

    container.appendChild(categoryDiv);
  });
}

function addSkillTag(container: HTMLElement, skill: string) {
  const tag = document.createElement('div');
  tag.className = 'skill-tag';
  tag.innerHTML = `
    <span>${escapeHtml(skill)}</span>
    <button type="button" class="skill-tag-remove">×</button>
  `;
  tag.querySelector('.skill-tag-remove')?.addEventListener('click', () => {
    tag.remove();
  });
  container.appendChild(tag);
}

function renderExperience(experience: Experience[]) {
  const container = document.getElementById('experience-container');
  if (!container) return;

  container.innerHTML = '';
  experience.forEach((exp, index) => {
    addExperienceItem(container, exp, index);
  });
}

function addExperienceItem(container: HTMLElement, exp?: Experience, index?: number) {
  const itemDiv = document.createElement('div');
  itemDiv.className = 'item-card';
  itemDiv.innerHTML = `
    <div class="item-card-header">
      <span class="item-card-title">Experience ${(index !== undefined ? index + 1 : container.children.length + 1)}</span>
      <button type="button" class="btn-remove">Remove</button>
    </div>
    <div class="form-group">
      <label>Company *</label>
      <input type="text" class="exp-company" value="${exp?.company || ''}" required>
    </div>
    <div class="form-group">
      <label>Role *</label>
      <input type="text" class="exp-role" value="${exp?.role || ''}" required>
    </div>
    <div class="form-group">
      <label>Location</label>
      <input type="text" class="exp-location" value="${exp?.location || ''}">
    </div>
    <div class="form-group">
      <label>Start Date *</label>
      <input type="text" class="exp-start-date" value="${exp?.startDate || ''}" placeholder="Jan 2021" required>
    </div>
    <div class="form-group">
      <label>End Date</label>
      <input type="text" class="exp-end-date" value="${exp?.endDate === 'Present' ? 'Present' : exp?.endDate || ''}" placeholder="Present or Dec 2023">
    </div>
    <div class="form-group">
      <label>Bullet Points</label>
      <div class="bullets-container"></div>
      <button type="button" class="btn btn-secondary add-bullet-btn">Add Bullet</button>
    </div>
  `;

  const bulletsContainer = itemDiv.querySelector('.bullets-container') as HTMLElement;
  (exp?.bullets || []).forEach(bullet => {
    addBullet(bulletsContainer, bullet);
  });

  itemDiv.querySelector('.add-bullet-btn')?.addEventListener('click', () => {
    addBullet(bulletsContainer);
  });

  itemDiv.querySelector('.btn-remove')?.addEventListener('click', () => {
    itemDiv.remove();
  });

  container.appendChild(itemDiv);
}

function addBullet(container: HTMLElement, text?: string) {
  const bulletDiv = document.createElement('div');
  bulletDiv.className = 'bullet-item';
  bulletDiv.innerHTML = `
    <input type="text" class="bullet-text" value="${text || ''}" placeholder="Achievement or responsibility">
    <button type="button" class="btn-remove-bullet">Remove</button>
  `;
  bulletDiv.querySelector('.btn-remove-bullet')?.addEventListener('click', () => {
    bulletDiv.remove();
  });
  container.appendChild(bulletDiv);
}

function renderEducation(education: Education[]) {
  const container = document.getElementById('education-container');
  if (!container) return;

  container.innerHTML = '';
  education.forEach((edu, index) => {
    addEducationItem(container, edu, index);
  });
}

function addEducationItem(container: HTMLElement, edu?: Education, index?: number) {
  const itemDiv = document.createElement('div');
  itemDiv.className = 'item-card';
  itemDiv.innerHTML = `
    <div class="item-card-header">
      <span class="item-card-title">Education ${(index !== undefined ? index + 1 : container.children.length + 1)}</span>
      <button type="button" class="btn-remove">Remove</button>
    </div>
    <div class="form-group">
      <label>Institution *</label>
      <input type="text" class="edu-institution" value="${edu?.institution || ''}" required>
    </div>
    <div class="form-group">
      <label>Degree *</label>
      <input type="text" class="edu-degree" value="${edu?.degree || ''}" required>
    </div>
    <div class="form-group">
      <label>Field</label>
      <input type="text" class="edu-field" value="${edu?.field || ''}">
    </div>
    <div class="form-group">
      <label>Start Date *</label>
      <input type="text" class="edu-start-date" value="${edu?.startDate || ''}" required>
    </div>
    <div class="form-group">
      <label>End Date *</label>
      <input type="text" class="edu-end-date" value="${edu?.endDate || ''}" required>
    </div>
    <div class="form-group">
      <label>GPA</label>
      <input type="text" class="edu-gpa" value="${edu?.gpa || ''}">
    </div>
  `;

  itemDiv.querySelector('.btn-remove')?.addEventListener('click', () => {
    itemDiv.remove();
  });

  container.appendChild(itemDiv);
}

function renderProjects(projects: Project[]) {
  const container = document.getElementById('projects-container');
  if (!container) return;

  container.innerHTML = '';
  projects.forEach((project, index) => {
    addProjectItem(container, project, index);
  });
}

function addProjectItem(container: HTMLElement, project?: Project, index?: number) {
  const itemDiv = document.createElement('div');
  itemDiv.className = 'item-card';
  itemDiv.innerHTML = `
    <div class="item-card-header">
      <span class="item-card-title">Project ${(index !== undefined ? index + 1 : container.children.length + 1)}</span>
      <button type="button" class="btn-remove">Remove</button>
    </div>
    <div class="form-group">
      <label>Project Name *</label>
      <input type="text" class="project-name" value="${project?.name || ''}" required>
    </div>
    <div class="form-group">
      <label>Description *</label>
      <textarea class="project-description" rows="3" required>${project?.description || ''}</textarea>
    </div>
    <div class="form-group">
      <label>Technologies (comma-separated)</label>
      <input type="text" class="project-technologies" value="${project?.technologies?.join(', ') || ''}">
    </div>
    <div class="form-group">
      <label>URL</label>
      <input type="url" class="project-url" value="${project?.url || ''}">
    </div>
  `;

  itemDiv.querySelector('.btn-remove')?.addEventListener('click', () => {
    itemDiv.remove();
  });

  container.appendChild(itemDiv);
}

function renderCertifications(certifications: Certification[]) {
  const container = document.getElementById('certifications-container');
  if (!container) return;

  container.innerHTML = '';
  certifications.forEach((cert, index) => {
    addCertificationItem(container, cert, index);
  });
}

function addCertificationItem(container: HTMLElement, cert?: Certification, index?: number) {
  const itemDiv = document.createElement('div');
  itemDiv.className = 'item-card';
  itemDiv.innerHTML = `
    <div class="item-card-header">
      <span class="item-card-title">Certification ${(index !== undefined ? index + 1 : container.children.length + 1)}</span>
      <button type="button" class="btn-remove">Remove</button>
    </div>
    <div class="form-group">
      <label>Certification Name *</label>
      <input type="text" class="cert-name" value="${cert?.name || ''}" required>
    </div>
    <div class="form-group">
      <label>Issuer *</label>
      <input type="text" class="cert-issuer" value="${cert?.issuer || ''}" required>
    </div>
    <div class="form-group">
      <label>Date *</label>
      <input type="text" class="cert-date" value="${cert?.date || ''}" required>
    </div>
    <div class="form-group">
      <label>Expiry Date</label>
      <input type="text" class="cert-expiry-date" value="${cert?.expiryDate || ''}">
    </div>
    <div class="form-group">
      <label>Credential ID</label>
      <input type="text" class="cert-credential-id" value="${cert?.credentialId || ''}">
    </div>
  `;

  itemDiv.querySelector('.btn-remove')?.addEventListener('click', () => {
    itemDiv.remove();
  });

  container.appendChild(itemDiv);
}

function collectFormData(): CandidateProfile {
  // Contact
  const contact = {
    name: (document.getElementById('name') as HTMLInputElement).value,
    location: (document.getElementById('location') as HTMLInputElement).value || undefined,
    email: (document.getElementById('email') as HTMLInputElement).value || undefined,
    phone: (document.getElementById('phone') as HTMLInputElement).value || undefined,
    linkedin: (document.getElementById('linkedin') as HTMLInputElement).value || undefined,
    github: (document.getElementById('github') as HTMLInputElement).value || undefined,
    portfolio: (document.getElementById('portfolio') as HTMLInputElement).value || undefined,
  };

  // Summary
  const summary = (document.getElementById('summary') as HTMLTextAreaElement).value;

  // Skills
  const skills: { [category: string]: string[] } = {};
  document.querySelectorAll('.skill-category').forEach(categoryDiv => {
    const categoryName = (categoryDiv.querySelector('.skill-category-name') as HTMLInputElement)?.value || 'Other';
    const skillTags = Array.from(categoryDiv.querySelectorAll('.skill-tag span')).map(span => span.textContent || '');
    if (categoryName && skillTags.length > 0) {
      skills[categoryName] = skillTags;
    }
  });

  // Experience
  const experience: Experience[] = [];
  document.querySelectorAll('#experience-container .item-card').forEach(card => {
    const bullets: string[] = [];
    card.querySelectorAll('.bullet-text').forEach(input => {
      const text = (input as HTMLInputElement).value.trim();
      if (text) bullets.push(text);
    });

    experience.push({
      company: (card.querySelector('.exp-company') as HTMLInputElement).value,
      role: (card.querySelector('.exp-role') as HTMLInputElement).value,
      location: (card.querySelector('.exp-location') as HTMLInputElement).value || undefined,
      startDate: (card.querySelector('.exp-start-date') as HTMLInputElement).value,
      endDate: (card.querySelector('.exp-end-date') as HTMLInputElement).value || 'Present',
      bullets,
    });
  });

  // Education
  const education: Education[] = [];
  document.querySelectorAll('#education-container .item-card').forEach(card => {
    education.push({
      institution: (card.querySelector('.edu-institution') as HTMLInputElement).value,
      degree: (card.querySelector('.edu-degree') as HTMLInputElement).value,
      field: (card.querySelector('.edu-field') as HTMLInputElement).value || undefined,
      startDate: (card.querySelector('.edu-start-date') as HTMLInputElement).value,
      endDate: (card.querySelector('.edu-end-date') as HTMLInputElement).value,
      gpa: (card.querySelector('.edu-gpa') as HTMLInputElement).value || undefined,
    });
  });

  // Projects
  const projects: Project[] = [];
  document.querySelectorAll('#projects-container .item-card').forEach(card => {
    const techs = (card.querySelector('.project-technologies') as HTMLInputElement).value
      .split(',')
      .map(t => t.trim())
      .filter(t => t.length > 0);

    projects.push({
      name: (card.querySelector('.project-name') as HTMLInputElement).value,
      description: (card.querySelector('.project-description') as HTMLTextAreaElement).value,
      technologies: techs,
      url: (card.querySelector('.project-url') as HTMLInputElement).value || undefined,
    });
  });

  // Certifications
  const certifications: Certification[] = [];
  document.querySelectorAll('#certifications-container .item-card').forEach(card => {
    certifications.push({
      name: (card.querySelector('.cert-name') as HTMLInputElement).value,
      issuer: (card.querySelector('.cert-issuer') as HTMLInputElement).value,
      date: (card.querySelector('.cert-date') as HTMLInputElement).value,
      expiryDate: (card.querySelector('.cert-expiry-date') as HTMLInputElement).value || undefined,
      credentialId: (card.querySelector('.cert-credential-id') as HTMLInputElement).value || undefined,
    });
  });

  return {
    contact,
    summary,
    skills,
    experience,
    education,
    projects: projects.length > 0 ? projects : undefined,
    certifications: certifications.length > 0 ? certifications : undefined,
  };
}

async function saveProfile() {
  try {
    const profile = collectFormData();
    const response = await chrome.runtime.sendMessage({
      type: 'SAVE_PROFILE',
      data: profile,
    });

    if (response?.success) {
      showStatus('Profile saved successfully!', 'success');
      profileData = profile;
    } else {
      showStatus('Failed to save profile', 'error');
    }
  } catch (error) {
    console.error('Failed to save profile:', error);
    showStatus('Failed to save profile', 'error');
  }
}

function exportProfile() {
  const profile = profileData || collectFormData();
  const json = JSON.stringify(profile, null, 2);
  const blob = new Blob([json], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'profile.json';
  a.click();
  URL.revokeObjectURL(url);
}

function importProfile() {
  document.getElementById('import-file')?.click();
}

async function handleImport(event: Event) {
  const file = (event.target as HTMLInputElement).files?.[0];
  if (!file) return;

  try {
    const text = await file.text();
    const profile = JSON.parse(text) as CandidateProfile;
    profileData = profile;
    populateForm(profile);
    await saveProfile();
    showStatus('Profile imported successfully!', 'success');
  } catch (error) {
    console.error('Failed to import profile:', error);
    showStatus('Failed to import profile. Please check the JSON format.', 'error');
  }
}

function showParseStatus(message: string, type: 'success' | 'error' | '') {
  const el = document.getElementById('parse-resume-status');
  if (!el) return;
  el.textContent = message;
  el.className = type ? `status-inline ${type}` : 'status-inline';
}

async function handleResumeFileSelect(event: Event) {
  const file = (event.target as HTMLInputElement).files?.[0];
  if (!file) return;
  try {
    const text = await file.text();
    (document.getElementById('resume-paste') as HTMLTextAreaElement).value = text;
    showParseStatus('Resume text loaded. Click "Create profile from resume (AI)" to parse.', '');
  } catch (e) {
    showParseStatus('Failed to read file.', 'error');
  }
  (event.target as HTMLInputElement).value = '';
}

async function parseResumeWithAI() {
  const textarea = document.getElementById('resume-paste') as HTMLTextAreaElement;
  const text = textarea?.value?.trim();
  if (!text) {
    showParseStatus('Paste resume text or upload a .txt file first.', 'error');
    return;
  }

  showParseStatus('Parsing resume with AI...', '');
  const btn = document.getElementById('parse-resume-btn');
  if (btn) (btn as HTMLButtonElement).disabled = true;

  try {
    const response = await chrome.runtime.sendMessage({
      type: 'PARSE_RESUME_FROM_TEXT',
      resumeText: text,
    });
    if (response?.ok) {
      profileData = response.data as CandidateProfile;
      populateForm(profileData);
      await saveProfile();
      showParseStatus('Profile created from resume! Review and save if needed.', 'success');
      textarea.value = '';
    } else {
      const message =
        (response && typeof response.message === 'string' && response.message) ||
        'Failed to parse resume.';
      showParseStatus(message, 'error');
    }
  } catch (error) {
    console.error('Parse resume error:', error);
    showParseStatus(typeof error === 'object' && error && 'message' in error ? String((error as Error).message) : 'Failed to parse resume.', 'error');
  } finally {
    if (btn) (btn as HTMLButtonElement).disabled = false;
  }
}

function showStatus(message: string, type: 'success' | 'error') {
  const statusEl = document.getElementById('status');
  if (!statusEl) return;

  statusEl.textContent = message;
  statusEl.className = `status ${type}`;
  setTimeout(() => {
    statusEl.className = 'status';
  }, 3000);
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

// Event listeners
document.addEventListener('DOMContentLoaded', () => {
  loadProfile();
  loadApiKey();

  document.getElementById('profile-form')?.addEventListener('submit', (e) => {
    e.preventDefault();
    saveProfile();
  });

  document.getElementById('add-skill-category')?.addEventListener('click', () => {
    const container = document.getElementById('skills-container');
    if (!container) return;
    const categoryDiv = document.createElement('div');
    categoryDiv.className = 'skill-category';
    categoryDiv.innerHTML = `
      <div class="skill-category-header">
        <input type="text" class="skill-category-name" placeholder="Category name">
        <button type="button" class="btn-remove">Remove</button>
      </div>
      <div class="skills-list"></div>
      <div class="skill-input-container">
        <input type="text" class="skill-input" placeholder="Add skill">
        <button type="button" class="btn btn-secondary add-skill-btn">Add</button>
      </div>
    `;
    const skillsList = categoryDiv.querySelector('.skills-list') as HTMLElement;
    categoryDiv.querySelector('.add-skill-btn')?.addEventListener('click', () => {
      const input = categoryDiv.querySelector('.skill-input') as HTMLInputElement;
      const skill = input.value.trim();
      if (skill) {
        addSkillTag(skillsList, skill);
        input.value = '';
      }
    });
    categoryDiv.querySelector('.btn-remove')?.addEventListener('click', () => {
      categoryDiv.remove();
    });
    container.appendChild(categoryDiv);
  });

  document.getElementById('add-experience')?.addEventListener('click', () => {
    const container = document.getElementById('experience-container');
    if (container) addExperienceItem(container);
  });

  document.getElementById('add-education')?.addEventListener('click', () => {
    const container = document.getElementById('education-container');
    if (container) addEducationItem(container);
  });

  document.getElementById('add-project')?.addEventListener('click', () => {
    const container = document.getElementById('projects-container');
    if (container) addProjectItem(container);
  });

  document.getElementById('add-certification')?.addEventListener('click', () => {
    const container = document.getElementById('certifications-container');
    if (container) addCertificationItem(container);
  });

  document.getElementById('export-profile')?.addEventListener('click', exportProfile);
  document.getElementById('import-profile')?.addEventListener('click', importProfile);
  document.getElementById('import-file')?.addEventListener('change', handleImport);

  document.getElementById('resume-file')?.addEventListener('change', handleResumeFileSelect);
  document.getElementById('parse-resume-btn')?.addEventListener('click', parseResumeWithAI);

  document.getElementById('save-api-key')?.addEventListener('click', saveApiKey);
});
