import { defineConfig } from 'vite';
import fs from 'fs';
import path from 'path';

// Custom plugin to copy recipes directory (including config.json and images) to dist/recipes
const copyRecipesPlugin = () => ({
  name: 'copy-recipes',
  closeBundle() {
    const srcDir = path.resolve(process.cwd(), 'recipes');
    const destDir = path.resolve(process.cwd(), 'dist/recipes');

    if (fs.existsSync(srcDir)) {
      fs.cpSync(srcDir, destDir, { recursive: true, force: true });
      console.info('[copy-recipes] Successfully copied recipes/ to dist/recipes/');
    }
  }
});

export default defineConfig(() => {
  // Configurable base path:
  // 1. Defaults to './' (Relative Path Mode) which is 100% portable out-of-the-box
  //    across root domains, subfolders, and local filesystems (due to our hash-based routing).
  // 2. Can be overridden via VITE_BASE_PATH env variable if an absolute base path is needed.
  const basePath = process.env.VITE_BASE_PATH || './';

  return {
    base: basePath,
    plugins: [copyRecipesPlugin()],
    test: {
      setupFiles: ['./src/vitest-setup.js'],
      environment: 'node'
    },
    server: {
      port: 3000,
      open: true
    }
  };
});
