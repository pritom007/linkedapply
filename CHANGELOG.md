# Changelog

## Latest Updates

### Job Extraction Improvements
- ✅ **Fixed job extraction from LinkedIn job feed pages** - The extension now works on:
  - Individual job detail pages (`/jobs/view/...`)
  - Job feed/collections pages (`/jobs/collections/...`)
  - Job search pages (`/jobs/search/...`)
- ✅ Enhanced selectors to handle LinkedIn's dynamic content
- ✅ Better handling of job cards and detail panels

### AI-Powered Resume Generation (Groq Integration)
- ✅ **Added Groq SDK integration** for AI-powered resume and cover letter generation
- ✅ Uses free Llama 3.1 70B model (`llama-3.1-70b-versatile`)
- ✅ API key management in Options page
- ✅ Automatic fallback to rule-based generation if API key is not set
- ✅ Improved prompts for better ATS optimization

### How to Use Groq AI Features

1. **Get a free Groq API key:**
   - Visit https://console.groq.com
   - Sign up for a free account
   - Create an API key

2. **Add API key to extension:**
   - Click the extension icon
   - Click "Edit Profile"
   - Scroll to "API Configuration" section
   - Enter your Groq API key
   - Click "Save API Key"

3. **Generate resumes:**
   - Navigate to any LinkedIn job page (feed or detail page)
   - Click the extension icon
   - Click "Generate CV" or "Generate Cover Letter"
   - The extension will use AI to tailor your resume

### Technical Changes
- Updated content script to handle multiple LinkedIn page types
- Added Groq API integration using fetch API (works in service workers)
- Enhanced error handling with fallback to rule-based generation
- Added API key storage in Chrome local storage
