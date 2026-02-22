# Creating Extension Icons

The extension needs icon files. You can create them using any image editor or online tool.

## Quick Option: Use Online Tools

1. Go to https://www.favicon-generator.org/ or https://favicon.io/
2. Upload or create a simple icon (e.g., a document/CV icon)
3. Download the PNG files
4. Rename and place them in `src/icons/`:
   - `icon16.png` (16x16 pixels)
   - `icon48.png` (48x48 pixels)  
   - `icon128.png` (128x128 pixels)

## Temporary Workaround

The extension will work without icons - Chrome will show a default icon. The icons are optional but recommended for a polished look.

## After Creating Icons

1. Place the PNG files in `src/icons/`
2. Run `npm run build` again
3. The icons will be copied to `dist/icons/` automatically
