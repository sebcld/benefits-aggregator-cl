import react from '@vitejs/plugin-react';
import path from 'node:path';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  plugins: [react()],
  resolve: {
    // Alias "@/..." de tsconfig.json.
    tsconfigPaths: true,
    // Next resuelve 'server-only' internamente; en los tests es un modulo vacio.
    alias: { 'server-only': path.resolve(import.meta.dirname, 'tests/support/empty.ts') },
  },
  test: {
    environment: 'jsdom',
    include: ['tests/**/*.test.{ts,tsx}'],
    setupFiles: ['tests/support/setup.ts'],
    restoreMocks: true,
  },
});
