# Vue Error Handling

A utility for handling routing & component errors in Vue apps.

## Install

```bash
npm install @side-xp/vue-error-handling
```

## Usage

```ts
import { hello } from '@side-xp/vue-error-handling'

hello('world') // => 'Hello, world!'
```

The full API reference is generated from the source by [TypeDoc](https://typedoc.org) and published to this project's GitHub Pages site.

## Stack

| Tool | Role |
|---|---|
| [tsdown](https://tsdown.dev) | Build (ESM bundle + `.d.ts` declarations) |
| [TypeScript](https://www.typescriptlang.org) | Language |
| [Biome](https://biomejs.dev) | Linter & formatter |
| [Vitest](https://vitest.dev) + [coverage-v8](https://vitest.dev/guide/coverage) | Testing & coverage |
| [publint](https://publint.dev) + [are-the-types-wrong](https://arethetypeswrong.github.io) | Package shape & types-resolution validation |
| [TypeDoc](https://typedoc.org) | API reference generation |
| [VitePress](https://vitepress.dev) | Documentation site |
| [Husky](https://typicode.github.io/husky) + [lint-staged](https://github.com/lint-staged/lint-staged) | Git hooks (pre-commit, pre-push) |
| [commitlint](https://commitlint.js.org) | Commit message linting |
| [semantic-release](https://semantic-release.gitbook.io) | Automated versioning, changelog & npm publish |
| GitHub Actions + Pages | CI, npm releases, docs hosting |
| [Dependabot](https://docs.github.com/code-security/dependabot) | Weekly dependency update PRs |

## Prerequisites

- **Node.js ≥ 24.15**. The exact version is pinned in `.nvmrc`. Use `nvm use` if you have nvm.
- **npm**

## Project structure

```
src/
  index.ts       # package entry, exposes the public API
  tests/         # Vitest tests
docs/            # VitePress site (+ protocols.md; generated api/ is gitignored)
dist/            # build output (gitignored)
```

## Scripts

| Script | Description |
|---|---|
| `npm run build` | Bundle to `dist/` (ESM + `.d.ts`) with tsdown |
| `npm run check` | Lint + type-check (the everyday "is it OK?" command) |
| `npm run fix` | Auto-fix everything fixable (Biome) |
| `npm run biome:check` / `biome:fix` | Biome lint/format only |
| `npm run verify` | Type-check only (`tsc`, no output) |
| `npm test` | Single test run (Vitest) |
| `npm run test:watch` | Run tests in watch mode (Vitest) |
| `npm run coverage` | One-shot test run with a coverage report |
| `npm run check:package` | Validate the packed tarball with publint + attw |
| `npm run docs:dev` | Generate the API reference and start the docs dev server |
| `npm run docs:build` | Generate the API reference and build the docs site |
| `npm run docs:preview` | Preview the built docs site |
| `npm run docs:api` | Generate the API markdown only |

## Development

### Linting & formatting

[Biome](https://biomejs.dev) handles linting and formatting in one tool, using the library preset (`@side-xp/biome-config/biome.lib.json`). The **pre-commit** hook runs `lint-staged`, which auto-formats staged files. `npm run check` additionally surfaces type errors.

### Testing

Tests live in `src/tests/` and run in the `node` environment. The **pre-push** hook runs the suite (`vitest run`) so failing tests can't be pushed. Coverage is **report-only**: `npm run coverage` prints the numbers and the CI posts a summary table on pull requests, but it never fails the build. (To test against the DOM, or to enforce coverage thresholds, see [`docs/protocols.md`](docs/protocols.md).)

### Path alias

`@` is aliased to `./src` for internal imports (source and tests):

```ts
import { hello } from '@/index'
```

### Building & publishing

`npm run build` produces an ESM bundle plus type declarations in `dist/`. Only `dist/` is published (see `files` in `package.json`). The `prepack` (build) and `prepublishOnly` (`check:package`) lifecycle scripts run automatically on publish, so a package that doesn't build or has a broken shape can never be released.

### Documentation

[TypeDoc](https://typedoc.org) generates Markdown API docs from the source's TSDoc comments, and [VitePress](https://vitepress.dev) renders them into a site alongside hand-written guides. The generated `docs/api/` is gitignored and rebuilt on every `docs:*` run and in CI.

## Commit conventions

This project enforces [Conventional Commits](https://www.conventionalcommits.org) via `commitlint`. The `commit-msg` hook rejects messages that don't follow:

```
<type>(<optional scope>): <short description>
```

Common types: `feat`, `fix`, `chore`, `docs`, `test`, `refactor`, `perf`, `ci`, `build`.

> **Why this matters:** `semantic-release` reads the commit history to choose the next version. A `feat` is a minor bump, a `fix` is a patch, and a `BREAKING CHANGE:` footer is a major bump.

## CI/CD

The GitHub Actions workflow (`.github/workflows/ci.yml`) has three jobs:

- **`check`**: runs on every push to an integration branch and on **every pull request**: lint + types, tests (with a coverage comment on PRs), build, and package validation (publint + attw).
- **`release`**: on push to `main` / `master` after `check` passes: `semantic-release` bumps the version, updates the changelog, **publishes to npm**, and cuts a GitHub Release.
- **`deploy-docs`**: after `release`: builds the VitePress site and deploys it to GitHub Pages.

A second workflow (`.github/workflows/commitlint.yml`) runs on pull requests only. It lints the PR title (which becomes the commit message when squash-merging) and every commit of the PR with `commitlint`, since commits made outside a local clone skip the Git hook. For Dependabot PRs, only the title is linted.
