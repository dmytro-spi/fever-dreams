import { promises as fs } from "node:fs";
import path from "node:path";

export const STORE_DIR = ".feverdreams";
export const CONFIG_FILE = "config.json";
export const WORKSPACES_DIR = "workspaces";
export const WORKSPACE_META = ".workspace.json";

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
