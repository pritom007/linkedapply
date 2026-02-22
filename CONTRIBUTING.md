# Contributing

## Development Setup

1. Install dependencies:
   ```bash
   npm install
   ```

2. Build the extension:
   ```bash
   npm run build
   ```

3. Load in Chrome:
   - Open `chrome://extensions/`
   - Enable "Developer mode"
   - Click "Load unpacked"
   - Select the `dist` folder

## Development Workflow

- Use `npm run dev` for watch mode during development
- The extension will rebuild automatically on file changes
- Reload the extension in Chrome after rebuilding

## Project Structure

- `src/background/` - Service worker for state management
- `src/content/` - Content script for LinkedIn extraction
- `src/popup/` - Extension popup UI
- `src/options/` - Profile editor page
- `src/renderer/` - Document preview and PDF generation
- `src/types/` - TypeScript type definitions

## Adding Features

1. Update types in `src/types/index.ts` if needed
2. Implement feature in appropriate directory
3. Update manifest.json if new permissions are needed
4. Test thoroughly before submitting
