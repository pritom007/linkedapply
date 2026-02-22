import type { Plugin } from 'vite';
import { readdir, copyFile, mkdir, rm, readFile, writeFile } from 'fs/promises';
import { join } from 'path';

export function reorganizeOutput(): Plugin {
  return {
    name: 'reorganize-output',
    closeBundle: async () => {
      const distDir = join(process.cwd(), 'dist');
      const srcDir = join(distDir, 'src');
      const assetsDir = join(distDir, 'assets');

      try {
        // Move HTML files from dist/src/*/index.html to dist/*/index.html
        const dirs = ['popup', 'options', 'renderer'];
        
        for (const dir of dirs) {
          const srcPath = join(srcDir, dir, 'index.html');
          const destDir = join(distDir, dir);
          const destPath = join(destDir, 'index.html');
          
          try {
            await mkdir(destDir, { recursive: true });
            
            // Read HTML file and fix paths
            let htmlContent = await readFile(srcPath, 'utf-8');
            
            // Fix CSS paths: /assets/... -> ../assets/...
            htmlContent = htmlContent.replace(/href="\/assets\//g, 'href="../assets/');
            htmlContent = htmlContent.replace(/src="\/assets\//g, 'src="../assets/');
            
            // Write fixed HTML
            await writeFile(destPath, htmlContent, 'utf-8');
            console.log(`Moved and fixed ${dir}/index.html`);
          } catch (err: any) {
            if (err.code !== 'ENOENT') {
              console.warn(`Could not move ${dir}/index.html:`, err.message);
            }
          }
        }

        // Clean up src directory
        try {
          await rm(srcDir, { recursive: true, force: true });
          console.log('Cleaned up src directory');
        } catch (err: any) {
          console.warn('Could not remove src directory:', err.message);
        }
      } catch (err) {
        console.error('Error reorganizing output:', err);
      }
    },
  };
}
