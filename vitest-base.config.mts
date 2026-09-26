import { defineConfig } from 'vitest/config';

// Component specs render real pages against the seeded mock backend. The first test in a file
// pays for compiling the page and seeding the data, which takes longer than Vitest's default
// 5 s when the whole suite runs in parallel.
export default defineConfig({
  test: {
    testTimeout: 20_000,
  },
});
