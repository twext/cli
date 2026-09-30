# 🔍 Validation

`twext validate` checks a project without writing anything. `twext build` runs the same checks first and stops before compiling if any of them fail, so a broken build never gets written.

```bash
twext validate
# ✓ 5 blocks validated
```

Errors fail the command with exit code 1. Warnings are printed and the command still succeeds.

## 📕 Table of Contents

<!-- START doctoc generated TOC please keep comment here to allow auto update -->
<!-- DON'T EDIT THIS SECTION, INSTEAD RE-RUN doctoc TO UPDATE -->

- [🧾 What Gets Checked](#-what-gets-checked)
- [🔬 Free Variables](#-free-variables)
- [⚠️ Warnings](#-warnings)
- [🚫 What It Doesn't Check](#-what-it-doesnt-check)

<!-- END doctoc generated TOC please keep comment here to allow auto update -->

## 🧾 What Gets Checked

The manifest has to load and name the right things:

- `twext.yml` is readable, defines an `entryPoint`, and the entry point loads as an ES module.
- The entry point exports a `blocks` map.
- `extension` is present, and `extension.id` is 1 to 64 lower-case letters and digits.
- `extension.className` is a valid JavaScript identifier and not a reserved word, if it's set.
- `blocks` has at least one entry, and every entry is a block mapping, a `---` separator, or a label.
- Every `extension.menus` value is a list of items or a menu mapping with `items` and an optional boolean `acceptReporters`, and every item is a string or a `{ text, value }` mapping of strings.

Then the manifest and the code are checked against each other:

- Every non-label block names an `opcode`, and no opcode is used twice.
- No opcode is `constructor` or `getInfo`, which the compiler generates.
- Every opcode has a function under the same key in the `blocks` map the entry point exports.
- Every `blockType` is one Twext knows.
- Every block's `text` is a string.
- Every block's `arguments` is a mapping of names to mappings.
- Every argument's `type` is one Twext knows, and every `menu` names a menu declared in `extension.menus`.

A handler exported under a key that no block declares is a warning, not an error. The handler is left out of the compiled file, so nothing breaks — but if you meant to add the block, you haven't.

## 🔬 Free Variables

The check worth knowing about is the one that isn't a typo check.

Twext parses `setup` and every handler with [espree](https://github.com/eslint/espree) and [eslint-scope](https://github.com/eslint/eslint-scope), collects the names each one reads but never declares, and compares them against the names that will exist in the compiled extension. A handler that reads a name that won't be there is a build error instead of a `ReferenceError` inside a Scratch project:

```mjs
// src/blocks/greeting.js
export function sayHello({ WHO }) {
  console.log(prefix, WHO);
}
```

```bash
✗ Handler "sayHello" references "prefix", which is not defined in the compiled extension; put shared state in "setup" or inline it
```

A name is available if it is:

- Declared at the top level of `setup`.
- `Scratch`.
- A JavaScript built-in or browser global — the ES2027 globals, `undefined`, `NaN`, `Infinity`, `globalThis`, `arguments`, and everything in the browser global set. That covers `console`, `Math`, `JSON`, `setTimeout`, `fetch`, and the rest of the standard library.

Nothing else is. The import that brought a helper into your module doesn't carry over, the module-level `const` next to it doesn't either, and one handler can't call another. [Setup](./writing-blocks.md#-setup) is where that state goes.

`setup` gets the same treatment. Its parameters are dropped when it's compiled, since it's called with nothing, so a parameter it uses is an error too:

```bash
✗ setup references "helper", which is not defined in the compiled extension
```

## ⚠️ Warnings

Three things warn instead of failing:

- `extension.name is missing; falling back to the project name`
- `extension.className is missing; deriving it from the id`
- `Handler "<opcode>" is exported but not declared in twext.yml`

## 🚫 What It Doesn't Check

Validation reads the manifest and the source. It has nothing to do with a running Scratch project, so it doesn't check:

- Whether the block text and the argument names line up. TurboWarp matches each `[NAME]` in `text` to a key of `arguments`; Twext passes both through and leaves it there.
- Whether the handler's parameters are the ones you meant to destructure.
- Whether a handler does the right thing with the arguments or calls TurboWarp's API correctly.
- Whether the compiled file runs. Load the built extension in TurboWarp for that.

One more shape of error comes from the compiler rather than the validator: a handler that Twext can't re-print from its source — a generator, for instance — passes `twext validate` and fails the build with `Could not parse handler function for block "<opcode>"`. See [Handlers](./writing-blocks.md#-handlers).
