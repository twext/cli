<a href="https://github.com/twext/twext">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="./assets/whiteLogo.svg" />
    <img src="./assets/regularLogo.svg" height="40" alt="Twext project logo" />
  </picture>
</a>

# Twext

> A modular, zero-config Node.js toolchain for authoring, validating, and compiling multi-file TurboWarp extensions with YAML manifests

## Table of Contents

<!-- START doctoc generated TOC please keep comment here to allow auto update -->
<!-- DON'T EDIT THIS SECTION, INSTEAD RE-RUN doctoc TO UPDATE -->

- [Highlights](#highlights)
- [Overview](#overview)
  - [Authors](#authors)
- [Usage](#usage)
- [Installation](#installation)
- [Editor setup](#editor-setup)
- [Feedback and Contributing](#feedback-and-contributing)

<!-- END doctoc generated TOC please keep comment here to allow auto update -->

## Highlights

- Turn several JavaScript files into a TurboWarp extension. Made for larger projects that would need a multi-file structure.
- Declare your extension's metadata, block signatures, and arguments in a single `twext.yml` manifest
- Keep every block handler in its own ES module; `twext build` compiles them into one self-contained extension script
- Static analysis catches problems before you even run the extension — missing exports, unknown block types and argument types, and references to names that won't exist at runtime
- Zero config: `init` scaffolds a working project, `build` validates then compiles, `validate` checks blocks against your handlers

## Overview

TurboWarp extensions are written as a single JavaScript file: one script that registers a class with `getInfo()` block definitions and a method per opcode. Kept in one file, that gets hard to read once an extension has more than a few blocks.

Twext takes the other path. You keep the block definitions and metadata in a YAML manifest, and each block's logic in its own ES module.

Validation is not just schema checking. Twext parses each handler and the `setup` function and walks their free variables, so a handler that references an undeclared helper or a typo'd argument name is a build error, not a runtime mystery inside the extension.

### Authors

Twext is maintained by the [Twext Team](https://github.com/twext).

## Usage

Scaffold a new project:

```bash
twext init
```

This writes a minimal `twext.yml`, `src/index.js`, and a sample `src/blocks/hello.js`. From there, `build` validates and compiles:

```bash
twext build
# writes dist/extension.js
```

Check a project without building:

```bash
twext validate
```

Publish and manage a TwextHub hub from the CLI:

```bash
twext signup
twext login
twext publish
twext yank 1.0.0
```

`signup` creates a new account. `login` signs in with your `@namespace` and password. Credentials live in `~/.twext/config.json` (mode `0600`) with `TWEXTHUB_URL`, `TWEXTHUB_TOKEN`, and `TWEXTHUB_NAMESPACE` as environment overrides for automation. The default hub is `https://twexts.sdisk.us/api/v1`; pass `-u` to point at another one. Hubs must be served over HTTPS, except loopback URLs (such as `http://localhost`) used in local development.

`publish` validates and builds, then uploads the project sources as a gzipped tarball — the hub unpacks it and compiles it itself, and a build that fails there comes back with its log. When the hub has Terms of Service that have not been accepted yet, `publish` accepts them automatically only when using a stored session token — mapping this command into CI with an automation token is deliberately left to you, so the terms gate can't be silently clicked through. `yank` removes a version. `logout` revokes the stored session at the hub, then discards the credentials.

The rest of the registry commands: `checkout` unpacks a published version's source tarball into a directory (`twext checkout myext@1.2.0`, `myext@^1.2` to resolve a range first, defaults to your own namespace), `info` and `search` read the registry, `tag set`/`tag rm` move dist-tags, `deprecate` flags a version (or drops the flag with `--clear`), and `notifications` lists review decisions and broadcasts — rows are marked read only when you pass `--read`. `publish --private` uploads a version that only you and the accounts you grant access can see.

For CI, create a scoped token once:

```bash
twext token create --name ci --scope publish --scope yank
TWEXTHUB_TOKEN=twext_... twext publish
```

Point either command at a different manifest with `-c`; override the build output with `-o`.

## Installation

Install globally to use the `twext` command anywhere:

```bash
npm install -g @twext/twext
```

Or add it to a single project's dev dependencies:

```bash
npm install --save-dev @twext/twext
```

Then run it with `npx`:

```bash
npx twext init
```

Requires Node.js 24 or newer.

## Editor setup

VS Code autocompletes and validates `twext.yml` once you register its JSON schema. Install the [YAML extension](https://marketplace.visualstudio.com/items?itemName=redhat.vscode-yaml) (by Red Hat) and add this to your workspace:

```jsonc
// .vscode/settings.json
{
  "yaml.schemas": {
    "./node_modules/@twext/twext/schema/twext.json": ["twext.yml"],
  },
}
```

For extension files, use `import("@twext/twext/types/extension")` in a JSDoc comment and enable JavaScript checking:

```jsonc
// jsconfig.json
{
  "compilerOptions": {
    "checkJs": true,
    "noEmit": true,
  },
}
```

```js
// src/index.js
/** @type {import("@twext/twext/types/extension").Blocks} */
const hello = (args, util) => "Hello, world!";
export const blocks = { hello };
```

## Feedback and Contributing

Bug reports and feature requests go in [issues](https://github.com/twext/twext/issues); questions and ideas for the project are welcome in [discussions](https://github.com/twext/twext/discussions).

Contributions are welcome — open an issue first if the change is bigger than a typo fix.
