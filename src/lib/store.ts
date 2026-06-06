import { promises as fs } from "node:fs";
import path from "node:path";

export const STORE_DIR = ".feverdreams";
export const CONFIG_FILE = "config.json";
export const WORKSPACES_DIR = "workspaces";
export const WORKSPACE_META = ".workspace.json";
export const APPLY_SESSION_DIR = "apply-session";
export const APPLY_MANIFEST = "manifest.json";
export const APPLY_LOCK = "lock.json";
export const APPLY_BACKUP_DIR = "backup";

/** Workspace-local files that belong to FeverDreams, not the mirrored project. */
export const WORKSPACE_META_PATHS = [WORKSPACE_META, "CLAUDE.md", ".claude"];

export interface Config {
  version: number;
  targetRoot: string;
  baseBranch: string | null;
  baseCommit: string | null;
  createdAt: string;
}

export interface WorkspaceMeta {
  name: string;
  baseBranch: string | null;
  baseCommit: string | null;
  sourceRoot: string;
  createdAt: string;
  /** Number of files mirrored as symlinks at creation time (null for older workspaces). */
  fileCount?: number;
}

export function storePath(targetRoot: string): string {
  return path.join(targetRoot, STORE_DIR);
}

export function configPath(targetRoot: string): string {
  return path.join(storePath(targetRoot), CONFIG_FILE);
}

export function workspacesPath(targetRoot: string): string {
  return path.join(storePath(targetRoot), WORKSPACES_DIR);
}

export function workspacePath(targetRoot: string, name: string): string {
  return path.join(workspacesPath(targetRoot), name);
}

export function applySessionPath(targetRoot: string): string {
  return path.join(storePath(targetRoot), APPLY_SESSION_DIR);
}

export function applyManifestPath(targetRoot: string): string {
  return path.join(applySessionPath(targetRoot), APPLY_MANIFEST);
}

export function applyLockPath(targetRoot: string): string {
  return path.join(applySessionPath(targetRoot), APPLY_LOCK);
}

export function applyBackupPath(targetRoot: string, rel: string): string {
  return path.join(applySessionPath(targetRoot), APPLY_BACKUP_DIR, rel);
}

export async function storeExists(targetRoot: string): Promise<boolean> {
  try {
    await fs.access(storePath(targetRoot));
    return true;
  } catch {
    return false;
  }
}

export async function readConfig(targetRoot: string): Promise<Config> {
  const raw = await fs.readFile(configPath(targetRoot), "utf8");
  return JSON.parse(raw) as Config;
}

export async function writeConfig(targetRoot: string, config: Config): Promise<void> {
  await fs.mkdir(storePath(targetRoot), { recursive: true });
  await fs.writeFile(configPath(targetRoot), JSON.stringify(config, null, 2) + "\n", "utf8");
}

export async function writeWorkspaceMeta(workspaceDir: string, meta: WorkspaceMeta): Promise<void> {
  await fs.writeFile(
    path.join(workspaceDir, WORKSPACE_META),
    JSON.stringify(meta, null, 2) + "\n",
    "utf8",
  );
}

export async function readWorkspaceMeta(workspaceDir: string): Promise<WorkspaceMeta | null> {
  try {
    const raw = await fs.readFile(path.join(workspaceDir, WORKSPACE_META), "utf8");
    return JSON.parse(raw) as WorkspaceMeta;
  } catch {
    return null;
  }
}

export type ApplyAction = "modified" | "added";

export interface ApplyChange {
  /** POSIX-ish path relative to the project / workspace root. */
  rel: string;
  action: ApplyAction;
  /** File mode (permission bits) of the workspace copy at apply time. */
  mode: number;
}

export interface ApplyManifest {
  /** Workspace whose changes are currently applied to the base. */
  workspace: string;
  appliedAt: string;
  baseRoot: string;
  files: ApplyChange[];
  /** Directories created under the base for `added` files, to prune on revert. */
  createdDirs: string[];
}

/** Who currently holds the apply lock. */
export interface ApplyHolder {
  pid: number;
  host: string;
  /** Optional logical session id (FEVERDREAMS_SESSION), for multi-agent setups. */
  session: string | null;
}

export type ApplyOperation = "apply" | "apply-test" | "branch";

/**
 * Atomic "base is busy" marker, written exclusively at the start of an apply and
 * removed on revert. Separate from the manifest (which records what to undo).
 */
export interface ApplyLock {
  workspace: string;
  operation: ApplyOperation;
  holder: ApplyHolder;
  acquiredAt: string;
}

export async function readApplyLock(targetRoot: string): Promise<ApplyLock | null> {
  try {
    const raw = await fs.readFile(applyLockPath(targetRoot), "utf8");
    return JSON.parse(raw) as ApplyLock;
  } catch {
    return null;
  }
}

export async function readApplyManifest(targetRoot: string): Promise<ApplyManifest | null> {
  try {
    const raw = await fs.readFile(applyManifestPath(targetRoot), "utf8");
    return JSON.parse(raw) as ApplyManifest;
  } catch {
    return null;
  }
}

export async function writeApplyManifest(targetRoot: string, manifest: ApplyManifest): Promise<void> {
  await fs.mkdir(applySessionPath(targetRoot), { recursive: true });
  await fs.writeFile(
    applyManifestPath(targetRoot),
    JSON.stringify(manifest, null, 2) + "\n",
    "utf8",
  );
}

export async function clearApplySession(targetRoot: string): Promise<void> {
  await fs.rm(applySessionPath(targetRoot), { recursive: true, force: true });
}

/** Walk up from `start` to find the nearest directory containing a `.feverdreams` store. */
export async function findStoreRoot(start: string): Promise<string | null> {
  let dir = path.resolve(start);
  for (;;) {
    if (await storeExists(dir)) return dir;
    const parent = path.dirname(dir);
    if (parent === dir) return null;
    dir = parent;
  }
}

/** True if `p` is the same as, or nested under, `root`. */
export function isInside(root: string, p: string): boolean {
  const rel = path.relative(path.resolve(root), path.resolve(p));
  if (rel === "") return true;
  return !rel.startsWith("..") && !path.isAbsolute(rel);
}
