# TypeScript package protocols

This document lists the operations to run, implementations to write and tools to use for specific cases that may happen during the development of a package.

> The goal of this document is to be as exhaustive as possible, leaving no doubt when it comes to add/use something in a project. Please report any missing part or need for more details.

Out of the box the template builds a modern, ESM-only, Node-targeted package. The sections below document how to adapt it for other targets (browser, hybrid, legacy consumers).

## Build a browser library

> Not tested

The default ESM output **already works for a browser library installed from npm**: the consumer's bundler (Vite, webpack, esbuild…) resolves the ESM entry directly. You only need the steps below to additionally support **CDN usage via a plain `<script>` tag**, which requires a self-contained IIFE bundle exposing a global.

> A pure-ESM package can already be loaded from a CDN with `<script type="module">` (e.g. `https://esm.sh/my-package`). The IIFE build is only needed for the classic `<script src>` style that exposes a global variable.

1. Target the browser and add an IIFE bundle in `tsdown.config.ts`:

```ts
import { defineConfig } from 'tsdown'

export default defineConfig({
  entry: ['src/index.ts'],
  format: ['esm', 'iife'],
  // `iife` requires a global name under which the library is exposed on `window`.
  globalName: 'MyLib',
  platform: 'browser',
  fixedExtension: false,
  tsconfig: 'tsconfig.lib.json',
  dts: true,
  clean: true,
  sourcemap: true,
})
```

2. Point the CDN fields in `package.json` at the IIFE bundle, and add a `browser` export condition:

```json
{
  "exports": {
    ".": {
      "types": "./dist/index.d.ts",
      "browser": "./dist/index.iife.js",
      "default": "./dist/index.js"
    }
  },
  "unpkg": "./dist/index.iife.js",
  "jsdelivr": "./dist/index.iife.js"
}
```

3. Consume it from a CDN:

```html
<!-- Classic global -->
<script src="https://unpkg.com/my-package"></script>
<script>MyLib.hello('world')</script>

<!-- Or modern ESM, no IIFE build required -->
<script type="module">
  import { hello } from 'https://esm.sh/my-package'
</script>
```

**Note**: if your source touches the DOM, also add the DOM type libs and a browser test environment (see [Test against the DOM (browser)](#test-against-the-dom-browser)).

## Re-add CJS output

> Not tested

The template is ESM-only by default. Add CJS only if you must support consumers that still `require()` your package (older Node setups, some bundler configs).

1. Add `cjs` to the formats in `tsdown.config.ts`:

```ts
format: ['esm', 'cjs'],
```

With `fixedExtension: false` and `"type": "module"`, this emits `index.js` (ESM) + `index.cjs` (CJS), and `index.d.ts` + `index.d.cts` for the types.

2. Add the `require` condition and a CJS `main` in `package.json`:

```json
{
  "exports": {
    ".": {
      "import": { "types": "./dist/index.d.ts", "default": "./dist/index.js" },
      "require": { "types": "./dist/index.d.cts", "default": "./dist/index.cjs" }
    }
  },
  "main": "./dist/index.cjs"
}
```

3. Drop the ESM-only escape hatch from the `check:package` script in `package.json`. With CJS now emitted, `require()` resolves to real CJS, so the `--ignore-rules cjs-resolves-to-esm` flag that silenced the ESM-only warning is no longer wanted:

```json
{
  "scripts": {
    "check:package": "publint --strict && attw --pack"
  }
}
```

4. Validate the dual-format resolution before publishing. `attw` exists precisely to catch the type-resolution pitfalls of dual packages:

```sh
npm run check:package
```

## Test against the DOM (browser)

> Not tested

Tests run in the `node` environment by default. Source that touches browser APIs (`document`, `window`, `localStorage`…) needs a DOM environment and the DOM type libs.

1. Install a DOM implementation, either `jsdom` (most common) or `happy-dom` (lighter, faster):

```sh
npm install --save-dev jsdom
```

2. Switch the test environment in `vitest.config.ts`, either globally:

```ts
test: {
  environment: 'jsdom',
}
```

…or per-file with a docblock at the top of the relevant test, keeping the rest of the suite in `node`:

```ts
// @vitest-environment jsdom
```

3. Add the DOM type libs to `tsconfig.lib.json` so `document`/`window` type-check:

```json
{
  "compilerOptions": {
    "lib": ["ES2023", "DOM", "DOM.Iterable"]
  }
}
```

**Note**: for tests that depend on real browser behaviour (layout, real event loop, CSS), prefer [Vitest browser mode](https://vitest.dev/guide/browser/) which runs the suite in an actual browser via Playwright, instead of the jsdom emulation.

## Enforce coverage thresholds

> Not tested

Coverage is **report-only** by default: `npm run coverage` prints a summary in the console and writes an HTML report to `coverage/`, plus JSON reports that CI uses to post a coverage comment on pull requests, but it never fails. Turn it into a hard gate only once a project warrants the discipline.

1. Add a `thresholds` block to `coverage` in `vitest.config.ts`. `vitest run --coverage` then exits non-zero when any metric falls below its floor:

```ts
coverage: {
  // …existing reporter/include/exclude…
  thresholds: {
    lines: 80,
    functions: 80,
    branches: 80,
    statements: 80,
  },
}
```

2. Keep the coverage comment on failing pull requests. The `check` job in `.github/workflows/ci.yml` already runs `npm run coverage`, so CI enforces the thresholds with no extra step. But when that step fails, GitHub skips the following steps, including the *Report coverage* one. Add `always()` to its condition so the comment still shows which metric fell short:

```yml
- name: Report coverage
  if: ${{ always() && github.event_name == 'pull_request' }}
  uses: davelosert/vitest-coverage-report-action@v2
```

**Note**: set `thresholds.autoUpdate: true` to have Vitest ratchet the numbers up automatically as coverage improves, locking in gains without manual edits.

## Add a documentation page

> Not tested

The VitePress site lives in `docs/`. Every `.md` file under it becomes a page at its path (`docs/guide/getting-started.md` → `/guide/getting-started`). The home page is `docs/index.md`; the API reference under `/api/` is generated by `npm run docs:api` and must not be edited by hand.

1. Create the page anywhere under `docs/`. Group related guides in a folder:

````md
---
# docs/guide/getting-started.md
title: Getting Started
---

# Getting Started

Install the package:

```sh
npm install my-package
```
````

The first `#` heading is used as the page title in the browser tab and search; the `title` frontmatter is optional and overrides it.

2. Make the page reachable. Add it to the top navigation, the sidebar, or both, in `docs/.vitepress/config.ts`.

Add a top-bar entry via `nav`:

```ts
nav: [
  { text: 'Guide', link: '/guide/getting-started' },
  { text: 'API', link: '/api/' },
],
```

Add a left sidebar for the `/guide/` section (the existing `/api/` sidebar is generated, leave it as-is):

```ts
sidebar: {
  '/guide/': [
    {
      text: 'Guide',
      items: [
        { text: 'Getting Started', link: '/guide/getting-started' },
        { text: 'Configuration', link: '/guide/configuration' },
      ],
    },
  ],
  '/api/': [{ text: 'Overview', link: '/api/' }, ...typedocSidebar],
},
```

**Note**: sidebar keys are path prefixes. A page only shows the sidebar whose prefix matches its URL, so `/guide/` pages get the guide sidebar and `/api/` pages keep the generated API sidebar.

3. Link between pages with root-absolute paths (omit the `.md` extension); VitePress rewrites them to the correct URL, including the GitHub Pages base path:

```md
See the [API reference](/api/) and the [hello function](/api/functions/hello).
```

4. Preview while writing with `npm run docs:dev`, then verify the production build with `npm run docs:build && npm run docs:preview`.

## Release the package to npm for the first time

> Not tested

After setup, releases are automated: the `release` CI job runs `semantic-release` on pushes to `main` / `master` and publishes to npm using **Trusted Publishing (OIDC)**, without any `NPM_TOKEN`. But a trusted publisher can only be attached to a package that already exists, so the first publish is a manual bootstrap.

1. **Claim the name.** Set `name` in `package.json` and confirm it is free (or use a scope you own):

```sh
npm view <name>   # a 404 means the name is available
```

2. **Bootstrap the package with one manual publish.** This creates the package on npm so a trusted publisher can be attached:

```sh
npm login
npm publish
```

`prepack` (build) and `prepublishOnly` (publint + attw) run automatically, so the manual publish is validated too. With `version` still at `0.0.0`, this publishes `0.0.0` purely to reserve the name. `semantic-release` will publish the first real version next.

3. **Configure the trusted publisher.** On npmjs.com → your package → *Settings → Trusted Publisher*, add a **GitHub Actions** publisher. All fields are case-sensitive:

   - **Organization or user**: your GitHub owner
   - **Repository**: the repo name
   - **Workflow filename**: `ci.yml` (filename only, not the path)
   - **Environment**: leave empty (the `release` job uses no environment)

4. **Lock it down (recommended).** On the package's *Settings → Publishing access*, choose **Require two-factor authentication and disallow tokens**. Trusted publishing keeps working; long-lived tokens stop working.

5. **Confirm the CI side is ready.** The `release` job already has `id-token: write` and no `NPM_TOKEN`. The only requirement is npm ≥ 11.5.1 / Node ≥ 22.14 on the runner (Node 24 satisfies this), and **not** setting `registry-url` on `setup-node` (it conflicts with semantic-release's OIDC auth). No changes needed unless you renamed the workflow file. In that case, update the trusted publisher's *Workflow filename* to match.

6. **Trigger the first automated release.** Push a releasable Conventional Commit to the default branch:

```sh
git commit -m "feat: initial public release"
git push origin master
```

`semantic-release` determines versions from git tags, not the npm registry, so it ignores the bootstrap `0.0.0` (which has no tag) and cuts the first real version as `1.0.0`. Watch the `release` job, then verify:

```sh
npm view <name> version
```

A GitHub Release, an updated `CHANGELOG.md`, and an npm **provenance** attestation (automatic with OIDC) accompany the publish.
