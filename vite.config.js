/* global process */
import { defineConfig } from 'vite';

export default defineConfig(() => {
  // Configurable base path:
  // 1. Defaults to './' (Relative Path Mode) which is 100% portable out-of-the-box
  //    across root domains, subfolders, and local filesystems (due to our hash-based routing).
  // 2. Can be overridden via VITE_BASE_PATH env variable if an absolute base path is needed.
  const basePath = process.env.VITE_BASE_PATH || './';

  return {
    base: basePath,
    server: {
      port: 3000,
      open: true
    }
  };
});
