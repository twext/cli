import { BLOCK_TYPES, ARGUMENT_TYPES, resolveSetup, pascalCase } from "./compile.js";
import { loadProject, readProjectConfig } from "./project.js";
import {
  RUNTIME_GLOBALS,
  handlerFreeVariables,
  programFreeVariables,
  topLevelDeclarations,
} from "./free-vars.js";

const IDENTIFIER = /^[A-Za-z_$][\w$]*$/;
export const EXTENSION_ID_PATTERN = /^[a-z0-9]{1,64}$/;
const hasOwn = (object, key) => Object.prototype.hasOwnProperty.call(object, key);
const RESERVED_WORDS = new Set([
  "await",
  "arguments",
  "break",
  "case",
  "catch",
  "class",
  "const",
  "continue",
  "debugger",
  "default",
  "delete",
  "do",
  "else",
  "enum",
  "eval",
  "export",
  "extends",
  "false",
  "finally",
  "for",
  "function",
  "if",
  "implements",
  "import",
  "in",
  "instanceof",
  "interface",
  "let",
  "new",
  "null",
  "package",
  "private",
  "protected",
  "public",
  "return",
  "static",
  "super",
  "switch",
  "this",
  "throw",
  "true",
  "try",
  "typeof",
  "var",
  "void",
  "while",
  "with",
  "yield",
]);
const RESERVED_OPCODES = new Set(["constructor", "getInfo"]);

// Every registry command that acts on the project's extension (yank, tag,
// deprecate) needs the same id, read from the same place, refused the same way.
export function readExtensionId(configPath, command) {
  let id;
  try {
    id = readProjectConfig(configPath).extension?.id;
  } catch {
    id = undefined;
  }
  if (!id) {
    throw new Error(
      `"${configPath}" has no extension.id; run twext ${command} from the project directory.`,
    );
  }
  if (typeof id !== "string" || !EXTENSION_ID_PATTERN.test(id)) {
    throw new Error(`extension.id "${id}" is invalid; expected 1-64 lower-case letters or digits.`);
  }
  return id;
}

export async function validateProject(configPath) {
  const errors = [];
  const warnings = [];
  let project;
  try {
    project = await loadProject(configPath);
  } catch (err) {
    return { ok: false, errors: [err.message], warnings: [], project: null };
  }

  const { config, module: mod } = project;
  const menuNames = new Set();

  if (!config.extension || typeof config.extension !== "object") {
    errors.push('twext.yml must define an "extension" section');
  } else {
    const ext = config.extension;
    if (typeof ext.id !== "string" || !EXTENSION_ID_PATTERN.test(ext.id)) {
      errors.push("extension.id must be 1-64 lower-case letters or digits (a-z, 0-9)");
    }
    if (!ext.name) {
      warnings.push("extension.name is missing; falling back to the project name");
    }
    if (ext.className) {
      if (
        typeof ext.className !== "string" ||
        !IDENTIFIER.test(ext.className) ||
        RESERVED_WORDS.has(ext.className)
      ) {
        errors.push(`extension.className "${ext.className}" is not a valid identifier`);
      }
    } else {
      warnings.push("extension.className is missing; deriving it from the id");
      const derivedPascal = pascalCase(ext.id || "Extension");
      const derived = /^[0-9]/.test(derivedPascal)
        ? `_${derivedPascal}Extension`
        : `${derivedPascal}Extension`;
      if (!IDENTIFIER.test(derived) || RESERVED_WORDS.has(derived)) {
        errors.push(
          "extension.className cannot be derived from the id; set it explicitly to a valid identifier",
        );
      }
    }
    validateMenus(errors, menuNames, ext.menus);
  }

  if (!Array.isArray(config.blocks) || config.blocks.length === 0) {
    errors.push('twext.yml must define at least one entry in "blocks"');
  } else {
    const declared = new Set();
    for (const block of config.blocks) {
      if (typeof block === "string") {
        if (block !== "---") {
          errors.push(`Blocks entry "${block}" must be a block mapping or a "---" separator`);
        }
        continue;
      }
      if (!block || typeof block !== "object" || Array.isArray(block)) {
        errors.push("Each blocks entry must be a mapping");
        continue;
      }
      const isLabel = block.blockType === "label";
      if (!isLabel) {
        if (typeof block.opcode !== "string" || !block.opcode) {
          errors.push("A blocks entry is missing an opcode");
          continue;
        }
        if (declared.has(block.opcode)) {
          errors.push(`Duplicate opcode "${block.opcode}" in blocks`);
        }
        if (RESERVED_OPCODES.has(block.opcode)) {
          errors.push(`Opcode "${block.opcode}" conflicts with a generated extension method`);
        }
        declared.add(block.opcode);
        if (typeof mod.blocks[block.opcode] !== "function" || !hasOwn(mod.blocks, block.opcode)) {
          errors.push(
            `Block "${block.opcode}" has no handler function exported in the "blocks" map`,
          );
        }
      }
      const name = block.opcode ?? block.text ?? "(unnamed block)";
      if (
        block.blockType !== undefined &&
        block.blockType !== null &&
        !hasOwn(BLOCK_TYPES, block.blockType)
      ) {
        errors.push(`Block "${name}" uses unknown blockType "${block.blockType}"`);
      }
      if (block.text !== undefined && typeof block.text !== "string") {
        errors.push(`Block "${name}" text must be a string`);
      }
      if (block.arguments !== undefined) {
        if (
          block.arguments === null ||
          typeof block.arguments !== "object" ||
          Array.isArray(block.arguments)
        ) {
          errors.push(`Block "${name}" arguments must be a mapping`);
        } else {
          for (const [argumentName, argument] of Object.entries(block.arguments)) {
            if (!argument || typeof argument !== "object" || Array.isArray(argument)) {
              errors.push(`Block "${name}" argument "${argumentName}" must be a mapping`);
              continue;
            }
            if (argument.type && !hasOwn(ARGUMENT_TYPES, argument.type)) {
              errors.push(
                `Block "${name}" argument "${argumentName}" uses unknown type "${argument.type}"`,
              );
            }
            if (argument.menu !== undefined && !menuNames.has(argument.menu)) {
              errors.push(
                `Block "${name}" argument "${argumentName}" references unknown menu "${argument.menu}"`,
              );
            }
          }
        }
      }
    }
    for (const [opcode, handler] of Object.entries(mod.blocks)) {
      if (typeof handler === "function" && !declared.has(opcode)) {
        warnings.push(`Handler "${opcode}" is exported but not declared in twext.yml`);
      }
    }
    validateReferences(errors, project);
  }

  return { ok: errors.length === 0, errors, warnings, project };
}

function validateMenuItems(items, label, errors) {
  for (const item of items) {
    if (typeof item === "string") continue;
    if (item && typeof item === "object" && !Array.isArray(item)) {
      if (
        !hasOwn(item, "text") ||
        !hasOwn(item, "value") ||
        typeof item.text !== "string" ||
        typeof item.value !== "string"
      ) {
        errors.push(`${label} item text and value must be strings`);
      }
      continue;
    }
    errors.push(`${label} items must be strings or { text, value } mappings`);
  }
}

function validateMenus(errors, menuNames, menus) {
  if (menus === undefined) return;
  if (!menus || typeof menus !== "object" || Array.isArray(menus)) {
    errors.push("extension.menus must be a mapping of menu names to menu definitions");
    return;
  }
  for (const [menuName, menu] of Object.entries(menus)) {
    menuNames.add(menuName);
    if (Array.isArray(menu)) {
      validateMenuItems(menu, `Menu "${menuName}"`, errors);
      continue;
    }
    if (!menu || typeof menu !== "object") {
      errors.push(`Menu "${menuName}" must be a list of items or a mapping`);
      continue;
    }
    if (menu.acceptReporters !== undefined && typeof menu.acceptReporters !== "boolean") {
      errors.push(`Menu "${menuName}" acceptReporters must be a boolean`);
    }
    if (menu.items === undefined) {
      errors.push(`Menu "${menuName}" must define items or be a plain list of items`);
    } else if (!Array.isArray(menu.items)) {
      errors.push(`Menu "${menuName}" items must be an array`);
    } else {
      validateMenuItems(menu.items, `Menu "${menuName}"`, errors);
    }
  }
}

function validateReferences(errors, { config, module: mod }) {
  let setupText = "";
  try {
    setupText = resolveSetup(mod.setup);
  } catch (err) {
    errors.push(`setup is not a string, function, or array: ${err.message}`);
  }
  const available = new Set(RUNTIME_GLOBALS);
  if (setupText.trim()) {
    try {
      for (const name of topLevelDeclarations(setupText)) available.add(name);
      const missing = [...programFreeVariables(setupText)].filter((name) => !available.has(name));
      if (missing.length > 0) {
        errors.push(
          `setup references ${missing
            .map((name) => `"${name}"`)
            .join(", ")}, which is not defined in the compiled extension`,
        );
      }
    } catch (err) {
      errors.push(`setup could not be analyzed: ${err.message}`);
    }
  }

  for (const block of config.blocks) {
    if (!block || typeof block !== "object" || Array.isArray(block)) continue;
    const handler = mod.blocks[block.opcode];
    if (block.blockType === "label" || typeof handler !== "function") continue;
    let missing;
    try {
      missing = [...handlerFreeVariables(handler.toString())].filter(
        (name) => !available.has(name),
      );
    } catch (err) {
      errors.push(`Handler "${block.opcode}" could not be analyzed: ${err.message}`);
      continue;
    }
    if (missing.length > 0) {
      errors.push(
        `Handler "${block.opcode}" references ${missing
          .map((name) => `"${name}"`)
          .join(
            ", ",
          )}, which is not defined in the compiled extension; put shared state in "setup" or inline it`,
      );
    }
  }
}
