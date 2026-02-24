import type { JobData, GenerationOptions, JobExtractionStatus } from '../types/index.js';

let currentJob: JobData | null = null;

function showStatus(message: string, type: 'info' | 'error') {
  const el = document.getElementById('status-bar');
  if (!el) return;
  el.textContent = message;
  el.className = `status-bar ${type}`;
  el.hidden = false;
}

function clearStatus() {
  const el = document.getElementById('status-bar');
  if (!el) return;
  el.hidden = true;
}

// Load current job data
async function loadJobData() {
  try {
    clearStatus();
    // First, try to extract job data from current tab if on LinkedIn
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (tab.url?.includes('linkedin.com/jobs/')) {
      // Show loading state
      const jobInfoEl = document.getElementById('job-info');
      if (jobInfoEl) {
        jobInfoEl.className = 'job-info';
        jobInfoEl.innerHTML = '<div class="loading">Extracting job information...</div>';
      }
      
      // Try extraction multiple times with increasing delays
      const maxRetries = 5;
      for (let attempt = 0; attempt < maxRetries; attempt++) {
        try {
          await new Promise(resolve => setTimeout(resolve, 800 + (attempt * 800)));
          const extractResponse = await chrome.tabs.sendMessage(tab.id!, { type: 'EXTRACT_JOB_DATA' });

          if (extractResponse?.success && extractResponse?.data) {
            const jobData = extractResponse.data;
            if (jobData.title && jobData.company && jobData.description && jobData.description.length > 50) {
              currentJob = jobData;
              displayJobInfo(currentJob);
              return;
            }
          }
        } catch (err) {
          console.log(`Extraction attempt ${attempt + 1} failed:`, err);
        }
      }

      // On LinkedIn we only show the job we just extracted - never stale stored job
      displayError('Could not read this job. Try: 1) Click the job in the list so the right panel updates, 2) Wait 2–3 seconds, 3) Open the extension again.');
      return;
    }

    // Not on LinkedIn: use stored job only as fallback (e.g. after opening from non-LinkedIn tab)
    const [jobResponse, statusResult] = await Promise.all([
      chrome.runtime.sendMessage({ type: 'GET_CURRENT_JOB' }),
      chrome.storage.local.get('jobExtractionStatus'),
    ]);

    const status = statusResult.jobExtractionStatus as JobExtractionStatus | undefined;

    if (jobResponse?.data) {
      currentJob = jobResponse.data;
      displayJobInfo(currentJob);
      if (status?.state === 'ready') {
        showStatus(status.message ?? 'Job detected from LinkedIn.', 'info');
      }
    } else {
      displayError('No job data found. Open a LinkedIn job page, wait for the job details to load, then open the extension.');
      if (status?.state === 'error' && status.message) {
        showStatus(status.message, 'error');
      }
    }
  } catch (error) {
    console.error('Failed to load job data:', error);
    displayError('Failed to load job information. Make sure you are on a LinkedIn job page.');
    showStatus('Could not load job data from the active tab.', 'error');
  }
}

function displayJobInfo(job: JobData) {
  const jobInfoEl = document.getElementById('job-info');
  if (!jobInfoEl) return;

  jobInfoEl.className = 'job-info';
  jobInfoEl.innerHTML = `
    <div class="job-title">${escapeHtml(job.title)}</div>
    <div class="job-company">${escapeHtml(job.company)}</div>
    <div class="job-location">${escapeHtml(job.location)}</div>
  `;
}

function displayError(message: string) {
  const jobInfoEl = document.getElementById('job-info');
  if (!jobInfoEl) return;

  jobInfoEl.className = 'job-info error';
  jobInfoEl.textContent = message;
}

function escapeHtml(text: string): string {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

function getGenerationOptions(): GenerationOptions {
  return {
    tone: (document.getElementById('tone') as HTMLSelectElement).value as 'formal' | 'neutral',
    emphasis: (document.getElementById('emphasis') as HTMLSelectElement).value as GenerationOptions['emphasis'],
    length: (document.getElementById('length') as HTMLSelectElement).value as '1-page' | '2-page',
  };
}

async function generateCV() {
  if (!currentJob) {
    alert('No job data available. Please navigate to a LinkedIn job page first.');
    return;
  }

  const btn = document.getElementById('generate-cv') as HTMLButtonElement;
  btn.disabled = true;
  btn.textContent = 'Generating...';

  try {
    const options = getGenerationOptions();
    const response = await chrome.runtime.sendMessage({
      type: 'GENERATE_RESUME',
      options,
    });

    if (response?.ok) {
      const { ts } = response.data as { ts: number };
      const rendererUrl = chrome.runtime.getURL(`renderer/index.html?type=resume&ts=${ts}`);
      chrome.tabs.create({ url: rendererUrl });
    } else {
      const message =
        (response && typeof response.message === 'string' && response.message) ||
        'Unknown error';
      alert('Failed to generate CV: ' + message);
    }
  } catch (error) {
    console.error('Error generating CV:', error);
    alert('Failed to generate CV. Please try again.');
  } finally {
    btn.disabled = false;
    btn.textContent = 'Generate CV';
  }
}

async function generateCoverLetter() {
  if (!currentJob) {
    alert('No job data available. Please navigate to a LinkedIn job page first.');
    return;
  }

  const btn = document.getElementById('generate-cover-letter') as HTMLButtonElement;
  btn.disabled = true;
  btn.textContent = 'Generating...';

  try {
    const options = getGenerationOptions();
    const response = await chrome.runtime.sendMessage({
      type: 'GENERATE_COVER_LETTER',
      options,
    });

    if (response?.ok) {
      const { ts } = response.data as { ts: number };
      const rendererUrl = chrome.runtime.getURL(`renderer/index.html?type=cover-letter&ts=${ts}`);
      chrome.tabs.create({ url: rendererUrl });
    } else {
      const message =
        (response && typeof response.message === 'string' && response.message) ||
        'Unknown error';
      alert('Failed to generate cover letter: ' + message);
    }
  } catch (error) {
    console.error('Error generating cover letter:', error);
    alert('Failed to generate cover letter. Please try again.');
  } finally {
    btn.disabled = false;
    btn.textContent = 'Generate Cover Letter';
  }
}

// Event listeners
document.addEventListener('DOMContentLoaded', () => {
  loadJobData();
  
  document.getElementById('generate-cv')?.addEventListener('click', generateCV);
  document.getElementById('generate-cover-letter')?.addEventListener('click', generateCoverLetter);
  
  document.getElementById('options-link')?.addEventListener('click', (e) => {
    e.preventDefault();
    chrome.runtime.openOptionsPage();
  });
});
