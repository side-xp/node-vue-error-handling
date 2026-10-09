# Contributing

## Stack

| Tool | Role |
|---|---|
| [tsdown](https://tsdown.dev) | Build (ESM bundle + `.d.ts` declarations) |
| [TypeScript](https://www.typescriptlang.org) + [vue-tsc](https://github.com/vuejs/language-tools) | Language, type-checking (including the playground's `.vue` files) |
| [Biome](https://biomejs.dev) | Linter & formatter |
| [Vitest](https://vitest.dev) + [jsdom](https://github.com/jsdom/jsdom) + [Vue Test Utils](https://test-utils.vuejs.org) | Testing & coverage |
| [Vite](https://vite.dev) | Playground app |
| [webpack](https://webpack.js.org) + [vue-loader](https://vue-loader.vuejs.org) | Webpack playground app (chunk loading failures with another bundler), sharing the stylesheet of the Vite playground |
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
  index.ts           # package entry, exposes the public API
  types.ts           # public types
  errorHandling.ts   # the plugin (`createErrorHandling()`)
  vuePhases.ts       # table of Vue's error types, mapped to phases
  tests/             # Vitest tests
playground/          # Vue app to try the library in a real app (never published)
  src/pages/         # one page per kind of error to trigger
  src/components/    # faulty components and the "Caught errors" panel
playground-webpack/  # Vue app built with webpack, for the chunk loading failures (never published)
dist/                # build output (gitignored)
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
| `npm run playground-webpack:build` | Build the webpack playground app (production build) |
| `npm run playground-webpack:preview` | Serve the built webpack playground app |

## Development

### Playground

`playground/` is a small Vite + Vue + Vue Router app, to try each feature in a real app while developing it. It imports the library by its package name (`@side-xp/vue-error-handling`), aliased to `src/index.ts`, so its code reads like an app using the installed package, and changes to the library are applied with HMR.

#### Running it

```sh
npm run playground
```

Open the URL printed by Vite (usually `http://localhost:5173`). Each page triggers errors of a given kind (e.g. *Component errors*: a component failing in each phase, failing event handlers). Every error received by the error handling is:

- logged to the browser console,
- listed in the **Caught errors** panel at the bottom of every page, with its source, message and context (e.g. the phase and the component of a component error, and the `info` given by Vue as is).

#### Production builds

Some behaviors only exist in production builds (e.g. the form of Vue's error types, or Vite's chunk loading errors). Try them with:

```sh
npm run playground:build
npm run playground:preview
```

Then open the URL printed by Vite (usually `http://localhost:4173`). In the **Caught errors** panel, Vue's `info` becomes a link to its error reference (e.g. `https://vuejs.org/error-reference/#runtime-0`), but the phases must be the same as in development.

#### Adding a scenario

When implementing a feature, add a way to trigger it in the playground:

- A new kind of error gets its own page in `playground/src/pages/`, with a route in `playground/src/router.ts` and a link in the navigation of `playground/src/App.vue`.
- Keep the scenarios explicit: one button (or toggle) per case, with a label that says what fails.
- Show the result on screen whenever possible (e.g. in the **Caught errors** panel), so a scenario can be checked without the browser's dev tools.

#### Never published

The playgrounds (including the [webpack playground](#webpack-playground)) can never be published:

- The build has a single entry (`src/index.ts`), and only bundles what it imports. The library never imports the playground.
- Only `dist/` is published (`files` in `package.json`). Run `npm pack --dry-run` to list the published files.

### Webpack playground

`playground-webpack/` is a minimal Vue + Vue Router app built with webpack. It only checks what the Vite playground can't: the chunk loading failures with another bundler than Vite, which the library doesn't detect out of the box. It uses the detection documented in the README for webpack (the `isChunkLoadError` option, checking the `ChunkLoadError` name of webpack's errors), and the library from `src/` like the Vite playground.

It only has a production build (the chunk loading failures don't happen with a dev server):

```sh
npm run playground-webpack:build
npm run playground-webpack:preview
```

Then open the URL printed by Vite (`http://localhost:4174`, the built app is served by `vite preview`), and follow the steps of its home page:

1. Delete the chunk of the deployed page, `playground-webpack/dist/DeployedPage.*.js`, without visiting that page first.
2. Go to the page: its chunk fails to load, so the page is loaded again.
3. The chunk is still missing after the reload: the page is not loaded again within 10 seconds, and the page boundary displays the error, flagged as a chunk loading failure.

> `vite preview` answers the missing chunk with the `index.html` of the app (as most servers configured for the history mode of the router do). Webpack runs it as a script: the browser also reports a `SyntaxError` (`Unexpected token '<'`), caught as a `global` error, before webpack rejects the chunk with its `ChunkLoadError`. With Vite, the missing chunk only fails its `import()`.

### Linting & formatting

[Biome](https://biomejs.dev) handles linting and formatting in one tool, using the library preset (`@side-xp/biome-config/biome.lib.json`). Its experimental full HTML support is enabled, so the templates of the `.vue` files are checked too (otherwise, variables only used in templates are reported as unused). The **pre-commit** hook runs `lint-staged`, which auto-formats staged files. `npm run check` additionally surfaces type errors.

### Testing

Tests live in `src/tests/` and run in the `jsdom` environment. The **pre-push** hook runs the suite (`vitest run`) so failing tests can't be pushed. Coverage is **report-only**: `npm run coverage` prints the numbers and the CI posts a summary table on pull requests, but it never fails the build.

> To enforce coverage, add a `thresholds` block (`lines`, `functions`, `branches`, `statements`) to `coverage` in `vitest.config.ts`, and add `always()` to the condition of the *Report coverage* step in `.github/workflows/ci.yml`, so the comment is still posted when the thresholds fail.

### Path alias

`@` is aliased to `./src` in the tests. The library itself only uses relative imports.

```ts
import { createErrorHandling } from '@/errorHandling'
```

### Keeping Vue's error types up to date

Vue gives the type of each error it catches to the error hooks (`info`), in a different form in each build:

- **Development builds**: a description (e.g. `'setup function'`), from Vue's `ErrorTypeStrings`.
- **Production builds**: a link to the [error reference](https://vuejs.org/error-reference/#runtime-errors), ending with the code of the error type (e.g. `'https://vuejs.org/error-reference/#runtime-0'`).

`src/vuePhases.ts` lists every error type (`VUE_ERROR_TYPES`: code, description, and the phase it's mapped to), and reads both forms. These are internal strings of Vue: a Vue release can add, remove or rename one, or change the production form. An unknown error type doesn't break anything (its phase is `other`), but it may be handled the wrong way (e.g. a boundary not replacing content that can't be displayed).

`src/tests/vuePhases.test.ts` detects these changes, against the **installed** Vue version:

- **"match the error types of the installed Vue version"** compares `VUE_ERROR_TYPES` to Vue's `ErrorTypeStrings` (codes and descriptions).
- **"match the form of the error types in the production build"** checks that the production build of Vue (`@vue/runtime-core/dist/runtime-core.cjs.prod.js`) still builds its `info` as an error reference link. Vitest always runs the development build of Vue, so the production build is checked from its source.

#### When upgrading Vue

Vue is upgraded through the `vue` dev dependency (e.g. a Dependabot PR). Each upgrade must run the tests (the CI does), and if one of the tests above fails:

1. Find what changed in Vue's source, for the new version: the `ErrorCodes` enum and `ErrorTypeStrings` in [`packages/runtime-core/src/errorHandling.ts`](https://github.com/vuejs/core/blob/main/packages/runtime-core/src/errorHandling.ts), and the `LifecycleHooks` enum in [`packages/runtime-core/src/enums.ts`](https://github.com/vuejs/core/blob/main/packages/runtime-core/src/enums.ts) (the lifecycle hooks use their own codes, e.g. `m` for `mounted`).
2. Update `VUE_ERROR_TYPES`: add, remove or rename the error types, and choose the phase of each new one. Mind the phases that prevent a component from being displayed (`setup`, `render`, `mount`, `asyncComponent`): a boundary replaces its content for these.
3. If the production form changed, update `ERROR_REFERENCE_URL` and `getVuePhase()` in `src/vuePhases.ts`, and the expected form in the test.
4. Check the result in the playground, in both builds (see [Production builds](#production-builds)): the phases listed in the **Caught errors** panel must be the same.

> The tests only check the installed version, but the table must also work with the oldest supported Vue version (see `peerDependencies`). If Vue removes an error type that older supported versions still give, keep it in the table, and relax the first test so it only checks that every error type of the installed version is in the table.

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
