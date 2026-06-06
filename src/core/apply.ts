import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawn } from "node:child_process";
import {
  storeExists,
  workspacePath,
  applySessionPath,
  applyLockPath,
  applyBackupPath,
  readApplyLock,
  readApplyManifest,
  writeApplyManifest,
  clearApplySession,
  type ApplyHolder,
  type ApplyLock,
  type ApplyManifest,
  type ApplyOperation,
} from "../lib/store.js";
import { collectChanges } from "./diff.js";

/** Read the current apply session (which workspace, if any, is applied to base). */
export async function currentApplySession(targetRoot: string): Promise<ApplyManifest | null> {
  return readApplyManifest(targetRoot);
}

/** Read the current apply lock (the authoritative "base is busy" marker). */
export async function currentApplyLock(targetRoot: string): Promise<ApplyLock | null> {
  return readApplyLock(targetRoot);
}

function selfHolder(): ApplyHolder {
  return {
    pid: process.pid,
    host: os.hostname(),
    session: process.env.FEVERDREAMS_SESSION ?? null,
  };
}

function describeHolder(lock: ApplyLock): string {
  const who = `${lock.holder.pid}@${lock.holder.host}`;
  const session = lock.holder.session ? `, session ${lock.holder.session}` : "";
  return `"${lock.workspace}" (${lock.operation}, ${who}${session}, since ${lock.acquiredAt})`;
}

/**
 * Atomically take the base lock. Fails if the base is already applied/locked.
 * The exclusive `wx` write is the single-writer primitive: only one process can
 * create the lock file, so concurrent applies cannot both win.
 */
async function acquireLock(
  targetRoot: string,
  workspace: string,
  operation: ApplyOperation,
): Promise<ApplyLock> {
  // Covers an already-applied base and legacy sessions that predate lock.json.
  const existingManifest = await readApplyManifest(targetRoot);
  if (existingManifest) {
    throw new Error(
      `Base already has "${existingManifest.workspace}" applied. Revert it first: feverdreams revert`,
    );
  }

  const lock: ApplyLock = {
    workspace,
    operation,
    holder: selfHolder(),
    acquiredAt: new Date().toISOString(),
  };

  await fs.mkdir(applySessionPath(targetRoot), { recursive: true });
  try {
    await fs.writeFile(applyLockPath(targetRoot), JSON.stringify(lock, null, 2) + "\n", {
      encoding: "utf8",
      flag: "wx",
    });
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === "EEXIST") {
      const held = await readApplyLock(targetRoot);
      const desc = held ? describeHolder(held) : "another process";
      throw new Error(
        `Base is locked by ${desc}. Revert it first: feverdreams revert (or feverdreams revert --force).`,
      );
    }
    throw err;
  }
  return lock;
}

async function pathExists(p: string): Promise<boolean> {
  try {
    await fs.access(p);
    return true;
  } catch {
    return false;
  }
}

async function copyWithMode(src: string, dest: string, mode: number): Promise<void> {
  await fs.mkdir(path.dirname(dest), { recursive: true });
  await fs.copyFile(src, dest);
  await fs.chmod(dest, mode);
}

/** Directories (relative to base) that don't yet exist and would need creating for `rel`. */
async function missingParentDirs(baseRoot: string, rel: string): Promise<string[]> {
  const out: string[] = [];
  let dir = path.dirname(rel);
  const stack: string[] = [];
  while (dir && dir !== "." && dir !== path.sep) {
    stack.push(dir);
    dir = path.dirname(dir);
  }
  // From shallowest to deepest, collect those that don't exist yet.
  for (const d of stack.reverse()) {
    if (!(await pathExists(path.join(baseRoot, d)))) out.push(d);
  }
  return out;
}

/**
 * Apply a workspace's changes onto the base project (file-level snapshot).
 * Backs up every base file before overwriting; records a manifest so the change
 * can be reverted. Throws if the base is already holding another workspace's
 * changes (single-slot lock) or if there is nothing to apply.
 */
export async function applyToBase(
  targetRoot: string,
  workspace: string,
  operation: ApplyOperation = "apply",
): Promise<ApplyManifest> {
  if (!(await storeExists(targetRoot))) {
    throw new Error("No .feverdreams store here. Run `feverdreams init` first.");
  }
  if (!(await pathExists(workspacePath(targetRoot, workspace)))) {
    throw new Error(`Workspace "${workspace}" not found.`);
  }

  // Take the lock atomically BEFORE touching any base file. From here on, any
  // early exit must release the lock so the base never stays falsely busy.
  await acquireLock(targetRoot, workspace, operation);

  try {
    const changes = await collectChanges(targetRoot, workspace);
    if (changes.length === 0) {
      throw new Error(`Workspace "${workspace}" has no changes to apply.`);
    }

    // Build the FULL plan first, then persist it before mutating the base. A crash
    // (SIGKILL) after this point leaves a manifest that `revert --force` can undo.
    const manifest: ApplyManifest = {
      workspace,
      appliedAt: new Date().toISOString(),
      baseRoot: targetRoot,
      files: [],
      createdDirs: [],
    };
    for (const c of changes) {
      if (c.action === "modified") {
        const baseMode = (await fs.stat(c.absBase)).mode & 0o777;
        manifest.files.push({ rel: c.rel, action: "modified", mode: baseMode });
      } else {
        for (const d of await missingParentDirs(targetRoot, c.rel)) {
          if (!manifest.createdDirs.includes(d)) manifest.createdDirs.push(d);
        }
        manifest.files.push({ rel: c.rel, action: "added", mode: c.mode });
      }
    }
    await writeApplyManifest(targetRoot, manifest);

    // Now mutate the base. Backups happen BEFORE overwriting so a partial apply
    // is always recoverable from the manifest.
    for (const c of changes) {
      if (c.action === "modified") {
        const baseMode = (await fs.stat(c.absBase)).mode & 0o777;
        await copyWithMode(c.absBase, applyBackupPath(targetRoot, c.rel), baseMode);
        await copyWithMode(c.absWs, c.absBase, c.mode);
      } else {
        await fs.mkdir(path.dirname(c.absBase), { recursive: true });
        await copyWithMode(c.absWs, c.absBase, c.mode);
      }
    }
    return manifest;
  } catch (err) {
    // Roll back whatever was applied (using the persisted plan, if any), release lock.
    const planned = await readApplyManifest(targetRoot);
    if (planned) await rollback(targetRoot, planned);
    await clearApplySession(targetRoot);
    throw err;
  }
}

/** Undo the effects recorded in `manifest` (used by revert and by apply's rollback). */
async function rollback(targetRoot: string, manifest: ApplyManifest): Promise<void> {
  for (const f of manifest.files) {
    const absBase = path.join(targetRoot, f.rel);
    if (f.action === "modified") {
      const backup = applyBackupPath(targetRoot, f.rel);
      if (await pathExists(backup)) {
        await copyWithMode(backup, absBase, f.mode);
      }
    } else {
      await fs.rm(absBase, { force: true });
    }
  }
  // Prune created dirs, deepest first, only if empty.
  const dirs = [...manifest.createdDirs].sort((a, b) => b.length - a.length);
  for (const d of dirs) {
    try {
      await fs.rmdir(path.join(targetRoot, d));
    } catch {
      // not empty / already gone — leave it
    }
  }
}

export interface RevertOptions {
  /** If set, refuse to revert unless the applied workspace matches (unless `force`). */
  expectWorkspace?: string;
  /** Force-release: clear the lock even with no manifest / mismatched workspace. */
  force?: boolean;
}

/**
 * Revert the base to its pristine state, restoring backed-up files and removing
 * added ones, then release the lock. Throws if nothing is applied, or if
 * `expectWorkspace` is given and doesn't match (unless `force`). With `force`, a
 * stuck lock (e.g. a crashed apply) is cleared even if no manifest is present.
 */
export async function revertFromBase(
  targetRoot: string,
  opts: RevertOptions = {},
): Promise<ApplyManifest> {
  const { expectWorkspace, force } = opts;
  const lock = await readApplyLock(targetRoot);
  const manifest = await readApplyManifest(targetRoot);

  if (!lock && !manifest) {
    throw new Error("Nothing is applied to the base.");
  }

  const name = manifest?.workspace ?? lock!.workspace;
  if (expectWorkspace && expectWorkspace !== name && !force) {
    throw new Error(
      `Base holds "${name}", not "${expectWorkspace}". Revert without a name (or with --force) to undo it.`,
    );
  }

  if (manifest) await rollback(targetRoot, manifest);
  await clearApplySession(targetRoot);

  return (
    manifest ?? {
      workspace: name,
      appliedAt: lock!.acquiredAt,
      baseRoot: targetRoot,
      files: [],
      createdDirs: [],
    }
  );
}

export interface ApplyTestResult {
  exitCode: number;
  manifest: ApplyManifest;
}

/**
 * One-shot apply-test: apply the workspace, run `command` in the base project,
 * then ALWAYS revert (even if the command fails or throws). Returns the command's
 * exit code.
 */
export async function applyTest(
  targetRoot: string,
  workspace: string,
  command: string,
): Promise<ApplyTestResult> {
  const manifest = await applyToBase(targetRoot, workspace, "apply-test");
  try {
    const exitCode = await runInBase(targetRoot, command);
    return { exitCode, manifest };
  } finally {
    await revertFromBase(targetRoot, { expectWorkspace: workspace });
  }
}

function runInBase(targetRoot: string, command: string): Promise<number> {
  return new Promise((resolve, reject) => {
    const child = spawn(command, {
      shell: true,
      cwd: targetRoot,
      stdio: "inherit",
    });
    child.on("error", reject);
    child.on("close", (code) => resolve(code ?? 0));
  });
}
