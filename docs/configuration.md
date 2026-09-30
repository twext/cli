# ⚙️ Twext Configuration

Every Twext project has a `twext.yml` manifest. Twext reads the block palette, the arguments, and the extension metadata out of it, and `twext build` writes the compiled extension to `outputPath`.

Paths in the manifest — `entryPoint` and `outputPath` — are resolved relative to the manifest's own directory, so a project can be built from any working directory with `twext build -c path/to/twext.yml`.

Here is a manifest that uses every field:

```yaml
name: "super-utilities"
version: "1.0.0"
description: "Custom utility blocks for TurboWarp projects"
author: "Your Name"
license: "Apache-2.0"

entryPoint: "src/index.js"
outputPath: "dist/extension.js"

extension:
  id: "superutilities"
  name: "Super Utilities"
  className: "SuperUtilitiesExtension"
  color1: "#FF4D4D"
  color2: "#E60000"
  color3: "#B30000"

  menus:
    sizes:
      acceptReporters: true
      items:
        - "small"
        - "medium"
        - text: "Large"
          value: "lg"

blocks:
  - opcode: logMessage
    blockType: command
    text: "log [MESSAGE] to console"
    arguments:
      MESSAGE:
        type: string
        defaultValue: "Hello TurboWarp!"
  - "---"
  - blockType: label
    text: "Custom Utilities"
  - opcode: setSize
    blockType: command
    text: "set size to [SIZE]"
    arguments:
      SIZE:
        type: string
        menu: sizes
```

## 📕 Table of Contents

<!-- START doctoc generated TOC please keep comment here to allow auto update -->
<!-- DON'T EDIT THIS SECTION, INSTEAD RE-RUN doctoc TO UPDATE -->

- [📦 Project Fields](#-project-fields)
- [🧩 The `extension` Section](#-the-extension-section)
- [🧱 Blocks](#-blocks)
  - [Block Types](#block-types)
- [🔤 Arguments](#-arguments)
- [📋 Menus](#-menus)
- [🔗 How the Manifest Connects to the Code](#-how-the-manifest-connects-to-the-code)

<!-- END doctoc generated TOC please keep comment here to allow auto update -->

## 📦 Project Fields

- `name`: Project name. Used as the fallback for `extension.name`.
- `version`: Project version, as a string. It has to be SemVer. `twext publish` sends this to TwextHub as the published version.
- `description`: Short description of the extension.
- `author`: Author name or GitHub handle.
- `license`: SPDX license identifier. The `twext init` scaffold writes `MIT`. Twext doesn't check the value, and it isn't part of the compiled output.
- `entryPoint`: Path to the module that exports the `blocks` map. Required.
- `outputPath`: Where `twext build` writes the compiled extension. Defaults to `dist/extension.js`.

Only `entryPoint`, `extension`, and `blocks` are required. Anything else in the manifest is carried along untouched, so a project can keep its own fields in `twext.yml`.

> **Note:** The compiled extension's `getInfo()` only includes the `id`, the `name`, the block colors, the menus, and the block definitions. The project fields above are for you and for the registry — they don't end up in the built file.

## 🧩 The `extension` Section

- `id`: Stable ID TurboWarp uses to identify the extension. Required, 1 to 64 lower-case letters and digits (`a-z`, `0-9`) — the same rule TwextHub enforces. It can't be changed without breaking existing projects.
- `name`: Name shown in the block palette. Falls back to the project `name`, then to the `id`.
- `className`: Name of the generated extension class. Must be a valid JavaScript identifier and not a reserved word. Twext derives a PascalCase name from the `id` when it's missing, and prefixes it with an underscore when the derived name isn't a valid identifier.
- `color1`: Primary block color, as `#rrggbb`. Defaults to `#0070F3`.
- `color2`: Secondary block color. Left out of the output when it isn't set.
- `color3`: Tertiary block color. Left out of the output when it isn't set.
- `menus`: Dropdowns that block arguments select from. See [Menus](#-menus).

## 🧱 Blocks

`blocks` is a list, and the order is the order of the block palette. Three kinds of entries go in it:

1. A block mapping, which pairs an `opcode` with its handler.
2. A `"---"` string, which draws a horizontal separator in the palette.
3. A `label` block, which draws a bold caption and needs no opcode.

A block mapping takes these fields:

- `opcode`: Name of the handler's key in the `blocks` map the entry point exports. Required, and it can't be `constructor` or `getInfo` — both names belong to the generated class.
- `blockType`: One of the types below. Defaults to `reporter`.
- `text`: Label shown on the block. Defaults to the opcode. TurboWarp reads `[NAME]` in this string and matches it to the keys of `arguments`; Twext passes the text through without checking that the names line up.
- `arguments`: Mapping of argument name to argument definition. See [Arguments](#-arguments).

### Block Types

| `blockType`      | TurboWarp constant              |
| ---------------- | ------------------------------- |
| `command`        | `Scratch.BlockType.COMMAND`     |
| `reporter`       | `Scratch.BlockType.REPORTER`    |
| `boolean`        | `Scratch.BlockType.BOOLEAN`     |
| `hat`            | `Scratch.BlockType.HAT`         |
| `event`          | `Scratch.BlockType.EVENT`       |
| `loop`           | `Scratch.BlockType.LOOP`        |
| `cond`, `cblock` | `Scratch.BlockType.CONDITIONAL` |
| `button`         | `Scratch.BlockType.BUTTON`      |
| `label`          | `Scratch.BlockType.LABEL`       |

`cond` and `cblock` are the same block type under two names. `label` is the only type that doesn't need an `opcode`, and Twext compiles it to a `Scratch.BlockType.LABEL` block with no method behind it.

## 🔤 Arguments

An argument definition takes these fields:

- `type`: One of `string`, `text`, `number`, `boolean`, `angle`, `color`, `matrix`, or `note`. Defaults to `string`. `text` is a second name for `string`.
- `defaultValue`: Value used when the argument is left empty. It's written into the built file as-is, so a YAML number stays a number and a quoted string stays a string.
- `menu`: Name of a menu in `extension.menus` that this argument selects from. The argument keeps its `type` in the output, so the type still has to be a known one.

An argument without a `type` is compiled as a string argument, which is what most blocks want.

## 📋 Menus

Menus are declared in `extension.menus` as a mapping of menu names to definitions. A menu argument refers back to the menu by name.

A menu can be a plain list of items, which is shorthand for a menu with nothing but `items`:

```yaml
extension:
  menus:
    sizes:
      - "small"
      - "medium"
      - "large"
```

Or a mapping, which is the only way to set `acceptReporters`:

```yaml
extension:
  menus:
    sizes:
      acceptReporters: true
      items:
        - "small"
        - "medium"
        - "large"
```

- `acceptReporters`: Whether reporter blocks can be dropped into the menu. Almost always `true`. It isn't set at all when the menu is a plain list.
- `items`: The menu's items. Each item is either a string, which is displayed and passed to the block as-is, or a `{ text, value }` mapping, which displays `text` and hands `value` to the block.

The `{ text, value }` form is what you want when the value the block receives shouldn't be the text on screen:

```yaml
extension:
  menus:
    easing:
      items:
        - text: "Linear"
          value: "linear"
        - text: "Ease in and out"
          value: "ease-in-out"
```

A block argument that names a menu Twext doesn't know about is a build error, so a typo in the menu name never reaches the block palette.

## 🔗 How the Manifest Connects to the Code

Every non-label block in `blocks` needs a handler function under the same `opcode` in the `blocks` map that `entryPoint` exports. A missing handler is a build error, and a handler that isn't declared in the manifest is a warning — it doesn't get compiled, so it never reaches the block palette.

`setup` runs once when the extension loads, before any block runs, and the declarations at its top level are the names handlers are allowed to reference. That's covered in [Writing Blocks](./writing-blocks.md), and the checks themselves are in [Validation](./validation.md).
