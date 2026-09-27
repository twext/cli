import { existsSync, mkdirSync, readdirSync, statSync } from "node:fs";
import { relative, resolve } from "node:path";
import { extract as extractTar } from "tar";
import {
  downloadSource,
  getVersion,
  listVersions,
  resolveHubUrl,
  resolveNamespace,
  resolveToken,
} from "../hub.js";
import { isRange, resolveSpec } from "../spec.js";

function extractTarball(buffer, cwd) {
  return new Promise((finish, fail) => {
    const stream = extractTar({ cwd, gzip: true });
    stream.on("finish", finish);
    stream.on("error", fail);
    stream.end(buffer);
  });
}

export async function checkoutCommand(product, spec, directory, { url, token }, log) {
  if (!spec) {
    log.error("Usage: twext checkout <id>[@version] [directory]");
    return false;
  }

  const hub = resolveHubUrl(url);
  const authToken = resolveToken(token, hub);
  const storedNamespace = resolveNamespace(undefined, hub);
  if (!authToken || !storedNamespace) {
    log.error("Not logged in. Run twext login first.");
    return false;
  }

  let target;
  try {
    target = resolveSpec(spec, storedNamespace);
  } catch (err) {
    log.error(err.message);
    return false;
  }

  const destination = resolve(directory ?? target.id);
  const shown = relative(process.cwd(), destination) || ".";
  if (existsSync(destination)) {
    if (!statSync(destination).isDirectory()) {
      log.error(`${shown} exists and is not a directory`);
      return false;
    }
    if (readdirSync(destination).length > 0) {
      log.error(`${shown} exists and is not empty`);
      return false;
    }
  }

  try {
    let version = target.version ?? "latest";
    if (isRange(version)) {
      const page = await listVersions(hub, target.namespace, target.id, version, authToken);
      const match = page?.data?.[0];
      if (!match) {
        log.error(`No version of @${target.namespace}/${target.id} matches ${version}.`);
        return false;
      }
      version = match.version;
    }
    const meta = await getVersion(hub, target.namespace, target.id, version, authToken);
    version = meta.version;
    const tarball = await downloadSource(hub, authToken, target.namespace, target.id, version);
    mkdirSync(destination, { recursive: true });
    await extractTarball(tarball, destination);
    log.success(`Checked out @${target.namespace}/${target.id}@${version} into ${shown}`);
    return true;
  } catch (err) {
    log.error(err.message);
    return false;
  }
}
