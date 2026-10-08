# Contributing

## Stack

| Tool | Role |
|---|---|
| [tsdown](https://tsdown.dev) | Build (ESM bundle + `.d.ts` declarations) |
| [TypeScript](https://www.typescriptlang.org) + [vue-tsc](https://github.com/vuejs/language-tools) | Language, type-checking (including the playground's `.vue` files) |
| [Biome](https://biomejs.dev) | Linter & formatter |
| [Vitest](https://vitest.dev) + [jsdom](https://github.com/jsdom/jsdom) + [Vue Test Utils](https://test-utils.vuejs.org) | Testing & coverage |
| [Vite](https://vite.dev) | Playground app |
| [publint](https://publint.dev) + [are-the-types-wrong](https://arethetypeswrong.github.io) | Package shape & types-resolution validation |
| [Husky](https://typicode.github.io/husky) + [lint-staged](https://github.com/lint-staged/lint-staged) | Git hooks (pre-commit, pre-push) |
| [commitlint](https://commitlint.js.org) | Commit message linting |
| [semantic-release](https://semantic-release.gitbook.io) | Automated versioning, changelog & npm publish |
| GitHub Actions | CI, npm releases |
| [Dependabot](https://docs.github.com/code-security/dependabot) | Weekly dependency update PRs |

## Prerequisites

- **Node.js**: the version is pinned in `.nvmrc`. Use `nvm use` if you have nvm.
- **npm**

## Project structure

```
src/
  index.ts       # package entry, exposes the public API
  tests/         # Vitest tests
playground/      # Vue app to try the library in a real app (never published)
dist/            # build output (gitignored)
```

## Scripts

| Script | Description |
|---|---|
| `npm run build` | Bundle to `dist/` (ESM + `.d.ts`) with tsdown |
| `npm run check` | Lint + type-check (the everyday "is it OK?" command) |
| `npm run fix` | Auto-fix everything fixable (Biome) |
| `npm run biome:check` / `biome:fix` | Biome lint/format only |
| `npm run verify` | Type-check only (`vue-tsc`, no output) |
| `npm test` | Single test run (Vitest) |
| `npm run test:watch` | Run tests in watch mode (Vitest) |
| `npm run coverage` | One-shot test run with a coverage report |
| `npm run check:package` | Validate the packed tarball with publint + attw |
| `npm run playground` | Start the playground app's dev server |
| `npm run playground:build` | Build the playground app (production build) |
| `npm run playground:preview` | Serve the built playground app |

## Development

### Playground

`playground/` is a small Vite + Vue + Vue Router app, to try each feature in a real app while developing it. It imports the library by its package name (`@side-xp/vue-error-handling`), aliased to `src/index.ts`, so its code reads like an app using the installed package, and changes to the library are applied with HMR.

Some behaviors only exist in production builds (e.g. Vue's error sources, or Vite's chunk loading errors): try them with `npm run playground:build` then `npm run playground:preview`.

The playground can never be published:

- The build has a single entry (`src/index.ts`), and only bundles what it imports. The library never imports the playground.
- Only `dist/` is published (`files` in `package.json`). Run `npm pack --dry-run` to list the published files.

### Linting & formatting

[Biome](https://biomejs.dev) handles linting and formatting in one tool, using the library preset (`@side-xp/biome-config/biome.lib.json`). Its experimental full HTML support is enabled, so the templates of the `.vue` files are checked too (otherwise, variables only used in templates are reported as unused). The **pre-commit** hook runs `lint-staged`, which auto-formats staged files. `npm run check` additionally surfaces type errors.

### Testing

Tests live in `src/tests/` and run in the `jsdom` environment. The **pre-push** hook runs the suite (`vitest run`) so failing tests can't be pushed. Coverage is **report-only**: `npm run coverage` prints the numbers and the CI posts a summary table on pull requests, but it never fails the build.

> To enforce coverage, add a `thresholds` block (`lines`, `functions`, `branches`, `statements`) to `coverage` in `vitest.config.ts`, and add `always()` to the condition of the *Report coverage* step in `.github/workflows/ci.yml`, so the comment is still posted when the thresholds fail.

### Path alias

`@` is aliased to `./src` in the tests. The library itself only uses relative imports.

```ts
import { hello } from '@/index'
```

### Building & publishing

`npm run build` produces an ESM bundle plus type declarations in `dist/`. `vue` and `vue-router` are peer dependencies, so they're never bundled. The `prepack` (build) and `prepublishOnly` (`check:package`) lifecycle scripts run automatically on publish, so a package that doesn't build or has a broken shape can never be released.

## Commit conventions

This project enforces [Conventional Commits](https://www.conventionalcommits.org) via `commitlint`. The `commit-msg` hook rejects messages that don't follow:

```
<type>(<optional scope>): <short description>
```

Common types: `feat`, `fix`, `chore`, `docs`, `test`, `refactor`, `perf`, `ci`, `build`.

> **Why this matters:** `semantic-release` reads the commit history to choose the next version. A `feat` is a minor bump, a `fix` is a patch, and a `BREAKING CHANGE:` footer is a major bump.

## CI/CD

The GitHub Actions workflow (`.github/workflows/ci.yml`) has two jobs:

- **`check`**: runs on every push to an integration branch and on **every pull request**: lint + types, tests (with a coverage comment on PRs), build, and package validation (publint + attw).
- **`release`**: on push to `main` / `master` after `check` passes: `semantic-release` bumps the version, updates the changelog, **publishes to npm**, and cuts a GitHub Release.

A second workflow (`.github/workflows/commitlint.yml`) runs on pull requests only. It lints the PR title (which becomes the commit message when squash-merging) and every commit of the PR with `commitlint`, since commits made outside a local clone skip the Git hook. For Dependabot PRs, only the title is linted.

## Release the package to npm for the first time

After setup, releases are automated: the `release` CI job runs `semantic-release` on pushes to `main` / `master` and publishes to npm using **Trusted Publishing (OIDC)**, without any `NPM_TOKEN`. But a trusted publisher can only be attached to a package that already exists, so the first publish is a manual bootstrap.

1. **Check the name is free** (a 404 means it's available):

```sh
npm view @side-xp/vue-error-handling
```

2. **Bootstrap the package with one manual publish.** This creates the package on npm so a trusted publisher can be attached. `prepack` and `prepublishOnly` run automatically, so this publish is validated too. With `version` still at `0.0.0`, it only reserves the name.

```sh
npm login
npm publish
```

3. **Configure the trusted publisher.** On npmjs.com, in the package's *Settings > Trusted Publisher*, add a **GitHub Actions** publisher. All fields are case-sensitive:

   - **Organization or user**: `side-xp`
   - **Repository**: `node-vue-error-handling`
   - **Workflow filename**: `ci.yml` (filename only, not the path)
   - **Environment**: leave empty (the `release` job uses no environment)

4. **Lock it down (recommended).** In the package's *Settings > Publishing access*, choose **Require two-factor authentication and disallow tokens**. Trusted publishing keeps working, long-lived tokens stop working.

5. **Trigger the first automated release** by pushing a releasable Conventional Commit (e.g. `feat: ...`) to the default branch. `semantic-release` determines versions from git tags, not the npm registry, so it ignores the bootstrap `0.0.0` (which has no tag) and cuts the first real version as `1.0.0`.

> Do **not** set `registry-url` on `setup-node` in the `release` job: it writes an `.npmrc` that conflicts with semantic-release's OIDC auth (`EINVALIDNPMTOKEN`).
