# Template setup guide

> **Delete this file once you've completed the steps below.**

This template produces a **Node-only, ESM-only** TypeScript package out of the box. For other targets (browser/CDN, hybrid Node+browser, CJS, DOM testing…), see [`docs/protocols.md`](docs/protocols.md).

## 1. Create your repository

Click **Use this template** on GitHub to create a new repository, then clone it:

```bash
git clone https://github.com/<your-username>/<your-repo>.git
cd <your-repo>
npm install
```

`npm install` runs the `prepare` script, which installs the Husky Git hooks.

## 2. Rename the package

Replace `my-package` (and the template's repository URL) with your own in:

- `package.json` → `"name"`
- `README.md` → title, description, install/usage snippets, and the API-reference URL
- `docs/.vitepress/config.ts` → `title` and the GitHub `socialLinks` URL
- `docs/index.md` → the hero `name` and the "View on GitHub" link

Keep the version at `0.0.0`: `semantic-release` sets the first real version on your first release.

> If your package name is scoped (`@scope/name`), `publishConfig.access` is already set to `public`. Change it to `restricted` for a private scoped package.

## 3. Set up npm publishing (Trusted Publishing)

The `release` job publishes via `semantic-release` using **npm Trusted Publishing (OIDC)**, so no long-lived `NPM_TOKEN` is needed. A trusted publisher can only be attached to an existing package, so the first publish is manual:

1. Make sure `name` in `package.json` is available (`npm view <name>` returns 404) or a scope you own.
2. Publish once from your machine to create the package: `npm login`, then `npm publish`.
3. On npmjs.com → your package → *Settings → Trusted Publisher*, add a **GitHub Actions** publisher with your org/user, repository, and workflow filename **`ci.yml`** (fields are case-sensitive).
4. *(Recommended)* On the package's *Publishing access*, choose **Require two-factor authentication and disallow tokens**.

Every release after that publishes automatically from CI. Full walkthrough: [docs/protocols.md → "Release the package to npm for the first time"](docs/protocols.md).

## 4. Enable GitHub Pages

The `deploy-docs` job publishes the documentation site to GitHub Pages:

- *Settings → Pages → Build and deployment → Source* = **GitHub Actions**.

Until this is enabled, the `deploy-docs` job will fail (and your editor may flag the `github-pages` environment as unknown until Pages is on).

## 5. First release

`release` and `deploy-docs` only run on push to `main` / `master`, and are skipped while the repository is still marked as a template. Once trusted publishing is set up (step 3) and you've pushed your own [Conventional Commits](https://www.conventionalcommits.org), a `feat:` or `fix:` on the default branch triggers the first automated release.

`GITHUB_TOKEN` is provided automatically by Actions, so no setup is needed for the GitHub Release and Pages deployment.
