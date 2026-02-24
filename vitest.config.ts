import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    include: ['tests/Unit/**/*.test.ts'],
    environment: 'node',
    restoreMocks: true,
    clearMocks: true,
  },
})
