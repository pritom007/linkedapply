# Quick Start Guide

## Installation

1. **Install dependencies:**
   ```bash
   npm install
   ```

2. **Build the extension:**
   ```bash
   npm run build
   ```

3. **Load in Chrome:**
   - Open Chrome and go to `chrome://extensions/`
   - Enable "Developer mode" (toggle in top right)
   - Click "Load unpacked"
   - Navigate to and select the `dist` folder in this project

## First-Time Setup

1. **Set up your profile:**
   - Click the extension icon in Chrome
   - Click "Edit Profile"
   - Fill in your contact information, experience, skills, education, etc.
   - Click "Save Profile"

2. **Generate your first CV:**
   - Navigate to any LinkedIn job posting (e.g., `https://www.linkedin.com/jobs/view/...`)
   - Click the extension icon
   - You should see the job title and company name
   - Adjust tone, emphasis, and length options if desired
   - Click "Generate CV" or "Generate Cover Letter"
   - A new tab will open with the preview
   - Click "Download PDF" and use Chrome's print dialog to save as PDF

## Icons

The extension needs icon files in `src/icons/`:
- `icon16.png` (16x16)
- `icon48.png` (48x48)
- `icon128.png` (128x128)

You can create simple placeholder icons or use any image editor. The extension will work without icons, but Chrome will show a default icon.

## Troubleshooting

- **"No job data found"**: Make sure you're on a LinkedIn job posting page (URL contains `/jobs/`)
- **Content script errors**: Refresh the LinkedIn page and try again
- **PDF not generating**: Make sure pop-ups are allowed for the extension

## Development

For development with auto-rebuild:
```bash
npm run dev
```

Then reload the extension in Chrome after each change.
