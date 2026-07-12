import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    // config/env.ts parses process.env at import time and exits on bad config,
    // so the suite needs a valid environment before any module loads.
    env: {
      NODE_ENV: "test",
      JWT_SECRET: "test-secret-value-not-used-in-production",
      PERSISTENCE: "memory",
    },
  },
});
