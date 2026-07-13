import { createRequire } from "node:module";
import { defineConfig } from "vitest/config";

// `graphql` ships no "exports" field: Node resolves it to `main` (index.js,
// CJS) while Vite prefers `module` (index.mjs, ESM). graphql-yoga and its
// executor are loaded natively by Node, so if Vite hands our own modules the
// .mjs copy there are two GraphQLError classes in the process and the
// `instanceof GraphQLError` check in maskError silently fails — every domain
// error would surface as INTERNAL_ERROR under test but be correct in prod.
// Pinning the specifier to the exact file Node loads keeps it to one class.
const graphqlEntry = createRequire(import.meta.url).resolve("graphql");

export default defineConfig({
  resolve: {
    alias: { graphql: graphqlEntry },
  },
  test: {
    // Most of the e2e suite provokes errors on purpose — a blocked close, a
    // forbidden triage — and Yoga logs every one of them. Keeping that output
    // for failing tests only means a green run reads as a list of test names,
    // while a red one still hands over the stack that explains it.
    silent: "passed-only",

    // config/env.ts parses process.env at import time and exits on bad config,
    // so the suite needs a valid environment before any module loads.
    env: {
      NODE_ENV: "test",
      JWT_SECRET: "test-secret-value-not-used-in-production",
    },
  },
});
