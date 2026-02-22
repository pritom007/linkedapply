# LinkedIn Job → ATS-Friendly CV & Cover Letter Generator

A Chrome Extension that extracts job information from LinkedIn job postings and generates ATS-friendly, tailored CVs and cover letters.

## Features

- **LinkedIn Job Extraction**: Automatically extracts job title, company, location, and full job description
- **ATS-Optimized Templates**: Single-column layout, no icons, clean structure for maximum ATS compatibility
- **Tailored Content**: Automatically aligns your profile with job keywords and requirements
- **Professional Design**: Modern typography and balanced spacing while maintaining ATS compatibility
- **PDF Export**: Generate PDFs directly from the browser
- **Profile Management**: Comprehensive profile editor with import/export functionality

## Installation

1. Clone this repository
2. Install dependencies:
   ```bash
   npm install
   ```
3. Build the extension:
   ```bash
   npm run build
   ```
4. Load the extension in Chrome:
   - Open Chrome and navigate to `chrome://extensions/`
   - Enable "Developer mode"
   - Click "Load unpacked"
   - Select the `dist` folder

## Development

```bash
# Watch mode for development
npm run dev

# Production build
npm run build
```

## Usage

1. **Set up your profile**:
   - Click the extension icon
   - Click "Edit Profile"
   - Fill in your contact information, experience, skills, education, etc.
   - Save your profile

2. **Generate a CV/Cover Letter**:
   - Navigate to a LinkedIn job posting
   - Click the extension icon
   - Adjust tone, emphasis, and length options
   - Click "Generate CV" or "Generate Cover Letter"
   - Preview and download as PDF

## Project Structure

```
src/
├── background/          # Service worker for state management
├── content/            # Content script for LinkedIn extraction
├── popup/              # Extension popup UI
├── options/            # Profile editor page
├── renderer/           # Document preview and PDF generation
├── types/              # TypeScript type definitions
└── manifest.json       # Extension manifest
```

## ATS Compatibility

The generated documents follow ATS best practices:
- Single-column layout
- No icons for essential information
- Simple, consistent headings
- Plain text bullets
- Consistent date formatting
- No complex tables or graphics
- Clean, parseable structure

## Technologies

- TypeScript
- Vite (build tool)
- Chrome Extension Manifest V3
- HTML/CSS for templates
- Browser Print API for PDF generation

## License

MIT
