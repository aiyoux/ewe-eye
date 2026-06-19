# Shared Packages

This repository contains the core packages that multiple app and module repositories depend on:

- `packages/item-tree`: Shared hierarchical tree logic and operations.
- `packages/module-sdk`: Shared module contracts and types.
- `packages/shell-core`: Shell/build composition helpers.
- `packages/ui`: Shared UI package boundary (Svelte components).

---

## Local Development Workflow (yalc)

For local development and cross-app sharing across projects under `~/Code` (e.g., `modular-app`, `sign-dictionary`), we use **`yalc`** to publish and link packages locally without registry overhead.

### 1. Register/Publish Packages Locally
To publish all workspaces inside this repository to your local yalc registry:
```bash
# From the root of shared-packages
npm install
npm run yalc:publish
```
This registers `@modular-app/module-sdk`, `@modular-app/item-tree`, `@modular-app/shell-core`, and `@modular-app/ui` into the local `~/.yalc` store.

### 2. Consume Packages in Consumer Applications
In your consumer application (e.g., `~/Code/modular-app` or `~/Code/sign-dictionary`), link the packages:

#### Option A: Link packages with `package.json` updates (Default)
Adds references to `.yalc/` directly into your `package.json` dependencies:
```bash
yalc add @modular-app/module-sdk @modular-app/item-tree @modular-app/shell-core @modular-app/ui
npm install
```
*To undo this and revert to your original pre-yalc dependencies:*
```bash
yalc retreat --all
npm install
```

#### Option B: Clean/Pure local injection (No `package.json` modifications)
If you want to keep your `package.json` pointing to an NPM registry or Git version (e.g., `"^0.1.0"`) for remote deployments/CI, but override them locally:
```bash
yalc add @modular-app/module-sdk @modular-app/item-tree @modular-app/shell-core @modular-app/ui --pure
```
*   `--pure` places the files inside `node_modules` without modifying your `package.json`.
*   Running `npm install` on any server or local repo will fetch from the registry normally, completely ignoring the yalc local override.

---

## Future Transition to a Remote NPM Registry

If you decide to publish these packages to a private or public NPM registry in the future (e.g., `@modular-app/ui` on npmjs.org or GitHub Packages):

1. **Publish to the Registry**:
   Set up authentication and publish all packages:
   ```bash
   npm publish --workspaces --access public
   ```
2. **Revert Yalc Locally**:
   Run the retreat command in your consumer applications to clean up the yalc configurations:
   ```bash
   yalc retreat --all
   ```
3. **Point to Registry**:
   Install standard semantic versions normally:
   ```bash
   npm install @modular-app/ui@latest
   ```
   If using pure injection (`yalc add --pure`), simply running `npm install` will fetch from the registry.

