// Content script for LinkedIn job pages
// Extracts job information from the page

interface ExtractedJobData {
  title: string;
  company: string;
  location: string;
  remoteType?: 'remote' | 'hybrid' | 'onsite';
  description: string;
  employmentType?: string;
  seniority?: string;
  url: string;
}

function normalizeForCompare(s: string): string {
  return s.toLowerCase().replace(/\s+/g, ' ').trim();
}

function titlesSimilar(a: string, b: string): boolean {
  const x = normalizeForCompare(a);
  const y = normalizeForCompare(b);
  return x.length > 0 && y.length > 0 && (x.includes(y) || y.includes(x) || x.slice(0, 20) === y.slice(0, 20));
}

function companiesSimilar(a: string, b: string): boolean {
  const x = normalizeForCompare(a);
  const y = normalizeForCompare(b);
  return x.length > 0 && y.length > 0 && (x.includes(y) || y.includes(x));
}

// Wait for job detail panel to appear (for feed pages). Prioritizes .jobs-search__job-details--wrapper
function waitForJobDetailPanel(_jobId: string | null, timeout: number = 8000): Promise<Element | null> {
  return new Promise((resolve) => {
    const startTime = Date.now();

    const checkForPanel = () => {
      // First: look for the known wrapper class
      const wrapper = document.querySelector('.jobs-search__job-details--wrapper');
      if (wrapper && (wrapper.textContent || '').length > 100) {
        resolve(wrapper);
        return;
      }

      // Fallback: other job detail containers
      const fallback = document.querySelector(
        '.jobs-search__job-details, .jobs-details__main-content, [data-test-id="job-details"]'
      );
      if (fallback && (fallback.textContent || '').length > 500) {
        resolve(fallback);
        return;
      }

      if (Date.now() - startTime < timeout) {
        setTimeout(checkForPanel, 400);
      } else {
        resolve(null);
      }
    };

    checkForPanel();
  });
}

function extractJobData(): ExtractedJobData | null {
  try {
    // Check if we're on a job detail page or job feed page
    const isJobDetailPage = window.location.pathname.includes('/jobs/view/') || 
                            window.location.pathname.match(/\/jobs\/\d+/);
    const isJobFeedPage = window.location.pathname.includes('/jobs/collections/') || 
                          window.location.pathname.includes('/jobs/search/');

    let title = '';
    let company = '';
    let locationText = '';
    let description = '';
    let employmentType: string | undefined;
    let seniority: string | undefined;

    if (isJobDetailPage) {
      // Extract from individual job detail page
      const titleElement = document.querySelector(
        '.jobs-details-top-card__job-title, ' +
        'h1.job-details-jobs-unified-top-card__job-title, ' +
        'h1[data-test-id="job-title"]'
      );
      title = titleElement?.textContent?.trim() || '';

      const companyElement = document.querySelector(
        '.jobs-details-top-card__company-name a, ' +
        '.job-details-jobs-unified-top-card__company-name a, ' +
        '.jobs-details-top-card__company-name, ' +
        '.job-details-jobs-unified-top-card__company-name, ' +
        'a[data-test-id="job-poster-name"]'
      );
      company = companyElement?.textContent?.trim() || '';

      const locationElement = document.querySelector(
        '.jobs-details-top-card__bullet, ' +
        '.job-details-jobs-unified-top-card__primary-description-without-tagline, ' +
        '.jobs-details-top-card__job-info-text, ' +
        '[data-test-id="job-location"]'
      );
      locationText = locationElement?.textContent?.trim() || '';

      // Expand "See more" button if present
      const seeMoreButton = document.querySelector(
        '.jobs-description__text button[aria-label*="more"], ' +
        '.jobs-description__text button[aria-label*="See more"], ' +
        'button[aria-expanded="false"]'
      ) as HTMLButtonElement;
      
      if (seeMoreButton && seeMoreButton.getAttribute('aria-expanded') === 'false') {
        seeMoreButton.click();
        setTimeout(() => {
          extractAndSend();
        }, 500);
        return null;
      }

      const descriptionElement = document.querySelector(
        '.jobs-description__text, ' +
        '.jobs-box__html-content, ' +
        '.jobs-description-content__text, ' +
        '[data-test-id="job-description"]'
      );
      
      if (descriptionElement) {
        const clone = descriptionElement.cloneNode(true) as HTMLElement;
        clone.querySelectorAll('button, .jobs-description__footer').forEach(el => el.remove());
        description = clone.textContent?.trim() || '';
      }

      const jobInfoElements = document.querySelectorAll(
        '.jobs-details-top-card__job-info, ' +
        '.job-details-jobs-unified-top-card__job-insight'
      );
      
      jobInfoElements.forEach(el => {
        const text = el.textContent?.toLowerCase() || '';
        if (text.includes('full-time') || text.includes('part-time') || text.includes('contract')) {
          employmentType = text;
        }
        if (text.includes('senior') || text.includes('junior') || text.includes('mid-level') || text.includes('lead')) {
          seniority = text;
        }
      });
    } else if (isJobFeedPage) {
      // Extract from job feed page - get the currently visible/selected job
      // Get currentJobId from URL
      const urlParams = new URLSearchParams(window.location.search);
      const currentJobId = urlParams.get('currentJobId');
      
      // PRIMARY: Target LinkedIn's job details wrapper (right-side panel when a job is selected)
      const wrapper = document.querySelector('.jobs-search__job-details--wrapper');
      let detailPanel: Element | null = null;

      if (wrapper) {
        const wrapperText = wrapper.textContent || '';
        if (wrapperText.length > 100) {
          detailPanel = wrapper;
        } else {
          // Wrapper might be a shell; use its main content child
          const inner = wrapper.querySelector('.jobs-search__job-details, div[role="main"], div > div');
          if (inner && (inner.textContent || '').length > 100) {
            detailPanel = inner;
          } else {
            detailPanel = wrapper;
          }
        }
      }

      // Fallback: other known LinkedIn job detail containers
      if (!detailPanel) {
        const fallbackSelectors = [
          '.jobs-search__job-details',
          '.jobs-details__main-content',
          'main.scaffold-layout__main .jobs-search__job-details',
          '[data-test-id="job-details"]',
          '.job-details-jobs-unified-top-card',
          '.jobs-details-top-card',
        ];
        for (const selector of fallbackSelectors) {
          const panel = document.querySelector(selector);
          if (panel && (panel.textContent || '').length > 200) {
            detailPanel = panel;
            break;
          }
        }
      }

      // Fallback: rightmost column in main (list | detail layout)
      if (!detailPanel) {
        const mainContent = document.querySelector('main.scaffold-layout__main, main[role="main"]');
        if (mainContent) {
          const columns = mainContent.querySelectorAll('div > div > div');
          if (columns.length >= 2) {
            const rightColumn = columns[columns.length - 1];
            const text = rightColumn.textContent || '';
            if (text.length > 500 && (text.includes('Apply') || text.includes('Description'))) {
              detailPanel = rightColumn;
            }
          }
        }
      }

      // Fallback: search by job ID
      if (!detailPanel && currentJobId) {
        const withJobId = document.querySelector(
          `[data-job-id="${currentJobId}"], [data-entity-urn*="${currentJobId}"]`
        );
        if (withJobId) {
          let current: Element | null = withJobId;
          for (let i = 0; i < 15 && current; i++) {
            const text = current.textContent || '';
            if (text.length > 1000 && current.querySelector('h1, h2, h3')) {
              detailPanel = current;
              break;
            }
            current = current.parentElement;
          }
        }
      }

      if (detailPanel) {
        // Extract title - try multiple selectors, also search in entire panel
        const titleSelectors = [
          'h2.job-details-jobs-unified-top-card__job-title',
          'h2[data-test-id="job-title"]',
          '.job-details-jobs-unified-top-card__job-title',
          'h2.jobs-details-top-card__job-title',
          'h1.job-details-jobs-unified-top-card__job-title',
          'h1[data-test-id="job-title"]',
          'h2.jobs-details-top-card__job-title-link',
          'a.job-details-top-card__job-title-link',
          'h1, h2, h3', // Fallback: any heading
        ];
        
        for (const selector of titleSelectors) {
          const titleEl = detailPanel.querySelector(selector);
          if (titleEl) {
            const text = titleEl.textContent?.trim() || '';
            // Make sure it's not too long (likely not a description) and not navigation
            if (text && text.length < 200 && 
                !text.includes('Apply') && 
                !text.includes('Save') &&
                !text.includes('Share')) {
              title = text;
              break;
            }
          }
        }
        // Structure fallback: first heading in panel is often the job title
        if (!title) {
          const firstHeading = detailPanel.querySelector('h1, h2, h3');
          if (firstHeading) {
            const text = firstHeading.textContent?.trim() || '';
            if (text.length > 0 && text.length < 200) title = text;
          }
        }

        // Extract company
        const companySelectors = [
          '.job-details-jobs-unified-top-card__company-name',
          'a[data-test-id="job-poster-name"]',
          '.jobs-details-top-card__company-name',
          'a.job-details-top-card__company-name-link',
          '.jobs-details-top-card__company-name a',
        ];
        
        for (const selector of companySelectors) {
          const companyEl = detailPanel.querySelector(selector);
          if (companyEl && companyEl.textContent?.trim()) {
            company = companyEl.textContent.trim();
            break;
          }
        }
        // Structure fallback: first link in panel (after possible title link) often goes to company
        if (!company) {
          const links = detailPanel.querySelectorAll('a[href*="/company/"], a[href*="company"]');
          for (const a of Array.from(links)) {
            const text = a.textContent?.trim() || '';
            if (text.length > 0 && text.length < 100 && !/apply|save|share/i.test(text)) {
              company = text;
              break;
            }
          }
        }

        // Extract location
        const locationSelectors = [
          '.job-details-jobs-unified-top-card__primary-description-without-tagline',
          '[data-test-id="job-location"]',
          '.jobs-details-top-card__bullet',
          '.job-details-jobs-unified-top-card__primary-description',
          '.jobs-details-top-card__job-info-text',
        ];
        
        for (const selector of locationSelectors) {
          const locationEl = detailPanel.querySelector(selector);
          if (locationEl && locationEl.textContent?.trim()) {
            locationText = locationEl.textContent.trim();
            break;
          }
        }
        // Structure fallback: look for text that looks like location (e.g. "City, Region" or "Remote")
        if (!locationText) {
          const spans = detailPanel.querySelectorAll('span');
          for (const span of Array.from(spans)) {
            const text = span.textContent?.trim() || '';
            if (text.length > 5 && text.length < 150 &&
                (text.includes(',') || /remote|hybrid|onsite|full-time|part-time/i.test(text)) &&
                !span.querySelector('span')) {
              locationText = text;
              break;
            }
          }
        }

        // Ensure we're not reading a stale panel: if URL has currentJobId, cross-check with the job card
        if (currentJobId && (title || company)) {
          const jobCard = document.querySelector(
            `[data-job-id="${currentJobId}"], [data-entity-urn*="${currentJobId}"]`
          );
          if (jobCard) {
            const cardTitle = jobCard.querySelector(
              '.job-card-list__title, .base-search-card__title, a[data-test-id="job-title-link"]'
            )?.textContent?.trim() || '';
            const cardCompany = jobCard.querySelector(
              '.job-card-container__company-name, .base-search-card__subtitle'
            )?.textContent?.trim() || '';
            const titleMatch = !cardTitle || !title || cardTitle.includes(title) || title.includes(cardTitle) || titlesSimilar(cardTitle, title);
            const companyMatch = !cardCompany || !company || cardCompany.includes(company) || company.includes(cardCompany) || companiesSimilar(cardCompany, company);
            if (!titleMatch || !companyMatch) {
              return null;
            }
          }
        }

        // Extract description - this is the most important part
        const descriptionSelectors = [
          '.jobs-description__text',
          '.jobs-box__html-content',
          '.jobs-description-content__text',
          '[data-test-id="job-description"]',
          '.jobs-description',
          'div.jobs-description__text',
          'section.jobs-description',
          '.jobs-details__job-description',
          '[id*="description"]',
          '[class*="description"]',
        ];
        
        for (const selector of descriptionSelectors) {
          const descEl = detailPanel.querySelector(selector);
          if (descEl) {
            const clone = descEl.cloneNode(true) as HTMLElement;
            // Remove buttons, footers, and other non-content elements
            clone.querySelectorAll(
              'button, ' +
              '.jobs-description__footer, ' +
              '.jobs-description__footer-item, ' +
              '[aria-label*="Apply"], ' +
              '[aria-label*="Save"], ' +
              '[aria-label*="Share"]'
            ).forEach(el => el.remove());
            const descText = clone.textContent?.trim() || '';
            if (descText.length > 200) { // Only use if it's substantial
              description = descText;
              break;
            }
          }
        }

        // If description is still empty, find the largest text block in the panel
        if (!description && detailPanel.textContent) {
          // Get all text-containing elements, sorted by text length
          const allElements = detailPanel.querySelectorAll('div, p, section, article');
          const textBlocks: Array<{ el: Element; text: string; length: number }> = [];
          
          for (const el of Array.from(allElements)) {
            const text = el.textContent?.trim() || '';
            // Filter out navigation, buttons, and metadata
            if (text.length > 300 && 
                !text.includes('Apply') && 
                !text.includes('Save') &&
                !text.includes('Share') &&
                !text.includes('Easy Apply') &&
                !text.match(/^\d+\s*(min|hour|day|week|month)/i) && // Skip time stamps
                !el.closest('button, a[role="button"]')) {
              textBlocks.push({ el, text, length: text.length });
            }
          }
          
          // Sort by length and take the longest (likely the description)
          textBlocks.sort((a, b) => b.length - a.length);
          if (textBlocks.length > 0 && textBlocks[0].length > 300) {
            const clone = textBlocks[0].el.cloneNode(true) as HTMLElement;
            clone.querySelectorAll('button, a[role="button"]').forEach(el => el.remove());
            description = clone.textContent?.trim() || '';
          }
        }
      }

      // Strategy 3: Fallback - try to extract from job card in the list
      if ((!title || !company) && currentJobId) {
        const jobCardSelectors = [
          `[data-job-id="${currentJobId}"]`,
          `[data-entity-urn*="${currentJobId}"]`,
          '.job-card-container--active',
          '.jobs-search-results__list-item--active',
        ];

        for (const selector of jobCardSelectors) {
          const jobCard = document.querySelector(selector);
          if (jobCard) {
            if (!title) {
              const titleEl = jobCard.querySelector(
                '.job-card-list__title, ' +
                'a[data-test-id="job-title-link"], ' +
                '.base-search-card__title, ' +
                'a.job-card-list__title-link'
              );
              title = titleEl?.textContent?.trim() || '';
            }

            if (!company) {
              const companyEl = jobCard.querySelector(
                '.job-card-container__company-name, ' +
                '.base-search-card__subtitle, ' +
                'a[data-test-id="job-poster-name"], ' +
                '.job-card-container__company-name-link'
              );
              company = companyEl?.textContent?.trim() || '';
            }

            if (!locationText) {
              const locationEl = jobCard.querySelector(
                '.job-card-container__metadata-item, ' +
                '.job-search-card__location, ' +
                '[data-test-id="job-location"]'
              );
              locationText = locationEl?.textContent?.trim() || '';
            }

            if (title && company) break;
          }
        }
      }
    }

    // Determine remote type
    let remoteType: 'remote' | 'hybrid' | 'onsite' | undefined;
    const locationLower = locationText.toLowerCase();
    if (locationLower.includes('remote')) {
      remoteType = 'remote';
    } else if (locationLower.includes('hybrid')) {
      remoteType = 'hybrid';
    } else {
      remoteType = 'onsite';
    }

    const url = window.location.href;

    // If we have title and company but no description, try multiple retries with increasing delays
    if ((title && company) && !description) {
      console.log('LinkedIn Job Extractor: Found job but description not loaded yet, will retry...', { title, company });
      
      // Try up to 3 times with increasing delays
      let retryCount = 0;
      const maxRetries = 3;
      
      const retryExtraction = () => {
        retryCount++;
        const jobData = extractJobData();
        if (jobData && jobData.description && jobData.description.length > 100) {
          // Success - send it
          chrome.runtime.sendMessage({
            type: 'JOB_DATA_EXTRACTED',
            data: jobData,
          }).catch(err => {
            console.error('Failed to send job data to background:', err);
          });
        } else if (retryCount < maxRetries) {
          // Retry with exponential backoff
          setTimeout(retryExtraction, 1000 * retryCount);
        }
      };
      
      setTimeout(retryExtraction, 1500);
      return null;
    }

    if (!title || !company) {
      console.warn('LinkedIn Job Extractor: Missing required fields', { title, company, description, url: window.location.href });
      return null;
    }

    // If description is missing but we have title/company, use a placeholder
    if (!description) {
      description = `Job description for ${title} at ${company}. Please visit the full job page for complete details.`;
    }

    return {
      title,
      company,
      location: locationText,
      remoteType,
      description,
      employmentType,
      seniority,
      url,
    };
  } catch (error) {
    console.error('LinkedIn Job Extractor: Error extracting job data', error);
    return null;
  }
}

async function extractAndSend() {
  // Check if we're on a feed page and need to wait for content
  const isJobFeedPage = window.location.pathname.includes('/jobs/collections/') || 
                        window.location.pathname.includes('/jobs/search/');
  
  if (isJobFeedPage) {
    const urlParams = new URLSearchParams(window.location.search);
    const currentJobId = urlParams.get('currentJobId');
    
    // Wait a bit for LinkedIn to load the job detail panel
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    // Try to wait for the panel to appear
    if (currentJobId) {
      const panel = await waitForJobDetailPanel(currentJobId, 5000);
      if (!panel) {
        console.log('LinkedIn Job Extractor: Job detail panel not found, trying direct extraction...');
      }
    }
  }
  
  const jobData = extractJobData();
  
  if (jobData) {
    console.log('LinkedIn Job Extractor: Successfully extracted job data', {
      title: jobData.title,
      company: jobData.company,
      descriptionLength: jobData.description.length
    });
    
    // Send to background script
    chrome.runtime.sendMessage({
      type: 'JOB_DATA_EXTRACTED',
      data: jobData,
    }).catch(err => {
      console.error('Failed to send job data to background:', err);
    });
  } else {
    console.warn('LinkedIn Job Extractor: Failed to extract job data');
  }
}

// Listen for messages from popup
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'EXTRACT_JOB_DATA') {
    (async () => {
      try {
        const isJobFeedPage = window.location.pathname.includes('/jobs/collections/') ||
                              window.location.pathname.includes('/jobs/search/');

        if (isJobFeedPage) {
          const urlParams = new URLSearchParams(window.location.search);
          const currentJobId = urlParams.get('currentJobId');

          // Wait for .jobs-search__job-details--wrapper to appear (detail panel)
          let panel = await waitForJobDetailPanel(currentJobId, 6000);
          if (!panel && currentJobId) {
            // Panel not found; try clicking the job card to open the detail view
            const jobCard = document.querySelector(
              `[data-job-id="${currentJobId}"], [data-entity-urn*="${currentJobId}"], a[href*="${currentJobId}"]`
            ) as HTMLElement;
            if (jobCard) {
              jobCard.click();
              await new Promise(resolve => setTimeout(resolve, 2500));
              panel = await waitForJobDetailPanel(currentJobId, 4000);
            }
          }
          if (panel) {
            await new Promise(resolve => setTimeout(resolve, 500));
          } else {
            await new Promise(resolve => setTimeout(resolve, 1000));
          }
        }

        const jobData = extractJobData();
        if (jobData) {
          // Always sync to background so popup and "Generate CV" use this same job
          chrome.runtime.sendMessage({
            type: 'JOB_DATA_EXTRACTED',
            data: { ...jobData, extractedAt: new Date().toISOString() },
          }).catch(() => {});
        }
        sendResponse({ success: !!jobData, data: jobData });
      } catch (error) {
        console.error('Extraction error:', error);
        sendResponse({ success: false, data: null, error: String(error) });
      }
    })();

    return true;
  }
  return false;
});

// Auto-extract when page loads
function delayedExtract() {
  // Wait longer for LinkedIn's dynamic content to load
  setTimeout(() => extractAndSend(), 2000);
  
  // Also try again after a longer delay in case content loads slowly
  setTimeout(() => extractAndSend(), 4000);
  
  // One more retry for slow connections
  setTimeout(() => extractAndSend(), 6000);
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', delayedExtract);
} else {
  delayedExtract();
}

// When URL (currentJobId) changes, clear stored job so we never show a previous job
let lastUrl = location.href;
let lastJobId: string | null = new URLSearchParams(window.location.search).get('currentJobId');

const urlObserver = new MutationObserver(() => {
  const currentUrl = location.href;
  if (currentUrl !== lastUrl) {
    const params = new URLSearchParams(new URL(currentUrl).search);
    const newJobId = params.get('currentJobId');
    if (lastJobId !== newJobId) {
      lastJobId = newJobId;
      chrome.runtime.sendMessage({ type: 'CLEAR_CURRENT_JOB' }).catch(() => {});
    }
    lastUrl = currentUrl;
    console.log('LinkedIn Job Extractor: URL changed, extracting...', currentUrl);
    setTimeout(extractAndSend, 2000);
  }
});

// Observe the entire document for changes (LinkedIn loads content dynamically)
let extractionTimeout: number | null = null;
const contentObserver = new MutationObserver(() => {
  // Trigger when the job details wrapper appears (user clicked a job)
  const wrapper = document.querySelector('.jobs-search__job-details--wrapper');
  const hasJobContent = wrapper?.textContent && wrapper.textContent.length > 100;
  const hasFallback = document.querySelector(
    '.jobs-description__text, .job-details-jobs-unified-top-card__job-title, [data-test-id="job-title"]'
  );

  if (hasJobContent || hasFallback) {
    if (extractionTimeout) clearTimeout(extractionTimeout);
    extractionTimeout = window.setTimeout(() => extractAndSend(), 1500);
  }
});

// Start observing
urlObserver.observe(document, { subtree: true, childList: true });
contentObserver.observe(document.body || document.documentElement, { 
  subtree: true, 
  childList: true,
  characterData: true 
});
