# Repository Guidelines

## Project Structure & Module Organization

This repository is a Vite + React 19 + TypeScript application for image-generation workflows. Main source files live in `src/`.

- `src/features/conversation/`: primary feature area, split into `domain`, `application`, `infra`, and `ui`
- `src/components/`, `src/hooks/`, `src/services/`, `src/utils/`, `src/types/`: shared UI, hooks, service adapters, helpers, and types
- `src/test/setup.ts`: shared Vitest setup
- `public/`: static assets
- `docs/`: architecture notes and implementation decisions
- `scripts/`: repository checks such as architecture and complexity validation
- `dist/`: build output; do not edit manually

## Build, Test, and Development Commands

Use Node.js 20+ and npm 10+.

- `npm run dev`: start the Vite dev server at `http://localhost:5173`
- `npm run build`: run TypeScript project build, then produce a production bundle
- `npm run preview`: serve the built app locally for verification
- `npm run lint`: run ESLint on the repository
- `npm run test`: run Vitest once in `jsdom`
- `npm run test:watch`: run Vitest in watch mode
- `npm run check:architecture`: enforce module boundary rules
- `npm run check:complexity`: run complexity checks
- `npm run ci`: run the full local gate before opening a PR

## Coding Style & Naming Conventions

Use UTF-8 encoding only. Follow the existing TypeScript style: 2-space indentation, semicolon-free statements, and ES module imports. Prefer function components and colocate code with its feature area.

- Components: `PascalCase.tsx`
- Hooks: `useSomething.ts`
- Utilities and services: `camelCase.ts`
- Tests: `*.test.ts` or `*.test.tsx`

Linting is configured through [`eslint.config.js`](/C:/Users/16370/Desktop/my-react-app/eslint.config.js). Keep imports focused and preserve the feature-layer separation under `src/features/conversation/`.

## Testing Guidelines

Vitest and Testing Library are the active test stack. Add or update tests for any changed behavior, especially in `domain`, `application`, and interactive UI flows.

- Place small unit tests beside the module they cover
- Use `src/features/.../__tests__/` where that pattern already exists
- Prefer behavior-focused test names, for example `conversationOrchestrator.test.ts`

No coverage threshold is currently enforced, so rely on targeted regression tests plus `npm run ci`.

## Commit & Pull Request Guidelines

Recent history favors short, imperative commit subjects, for example `Update architecture boundary checker` or `Review large-message perf plan`. Keep subjects specific and under roughly 70 characters.

Pull requests should include:

- a concise summary of user-visible or architectural changes
- linked issue or task context when available
- screenshots or short recordings for UI changes
- confirmation that `npm run ci` passed locally

## Architecture Notes

Read [`architecture.md`](/C:/Users/16370/Desktop/my-react-app/architecture.md) and the files in [`docs/`](/C:/Users/16370/Desktop/my-react-app/docs/) before large refactors. This project already uses explicit layering and repository checks to prevent cross-module drift.
