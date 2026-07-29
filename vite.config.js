import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { execSync } from 'node:child_process';

const buildVersion = (process.env.VERCEL_GIT_COMMIT_SHA
  || execSync('git rev-parse --short HEAD').toString().trim()).slice(0, 7);

export default defineConfig({
  plugins: [react()],
  define: { __BUILD_VERSION__: JSON.stringify(buildVersion) },
});
