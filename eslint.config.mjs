// ESLint 9 flat config — root (Cloudflare Worker).
//
// admin-app has its own eslint.config.js (React + Vite + JSX). This file
// only governs `src/` and Node-side scripts. Two packages, two configs.
import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import globals from 'globals';

export default [
  // Global ignores — applies to all config blocks below.
  {
    ignores: [
      'node_modules/**',
      'admin-app/**', // separate package, has its own eslint.config.mjs
      'dist/**',
      'wrangler-dry/**',
      '.wrangler/**',
      'drizzle/**', // generated migrations
      '.superpowers/**', // design docs, tmp files, not part of runtime
      '*.config.{js,cjs,mjs,ts}',
      'eslint.config.mjs',
      'test-drizzle.ts', // 7-line smoke script, not part of runtime
    ],
  },

  // Base recommended JS rules.
  js.configs.recommended,

  // TypeScript rules — recommended-type-checked for stricter behavior; we
  // already have `tsc --noEmit` in CI, so this re-uses the same type info.
  ...tseslint.configs.recommendedTypeChecked,

  // Worker source files.
  {
    files: ['src/**/*.ts'],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'module',
      globals: { ...globals.node },
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
    rules: {
      // Worker is server-only — Node globals are fine.
      // The harness tests in src/tests/_helpers/ mock node-only modules;
      // disabling no-require-imports lets the test suite use require()
      // for JSON imports (vitest config loader).
      '@typescript-eslint/no-require-imports': 'off',
      // The codebase uses `as any` casts in D1 binding paths (any in
      // repository constructors); allow that pattern but warn on others.
      '@typescript-eslint/no-explicit-any': 'warn',
      // Unused vars: allow `_`-prefixed; underscore is conventional for
      // intentionally-unused destructured args.
      '@typescript-eslint/no-unused-vars': [
        'warn',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_', caughtErrorsIgnorePattern: '^_' },
      ],
      // Drizzle SQL helpers (and, or, eq) are common in repos; allow.
      '@typescript-eslint/no-unsafe-assignment': 'off',
      '@typescript-eslint/no-unsafe-member-access': 'off',
      '@typescript-eslint/no-unsafe-call': 'off',
      '@typescript-eslint/no-unsafe-return': 'off',
      // Console output is intentional in this bot (PERF_LOG + error logging).
      'no-console': 'off',
      // Empty catch blocks with `.catch(() => {})` are used to swallow
      // answerCallbackQuery errors that the user has already dismissed.
      'no-empty': ['error', { allowEmptyCatch: true }],
    },
  },

  // Test files relax a few rules.
  {
    files: ['src/tests/**/*.ts', '**/*.test.ts'],
    languageOptions: {
      globals: { ...globals.node, ...globals.vitest },
    },
    rules: {
      // Tests intentionally use mocked contexts with `any` typing.
      '@typescript-eslint/no-explicit-any': 'off',
      '@typescript-eslint/no-unsafe-assignment': 'off',
      '@typescript-eslint/no-unsafe-member-access': 'off',
      '@typescript-eslint/no-non-null-assertion': 'off',
    },
  },
];
