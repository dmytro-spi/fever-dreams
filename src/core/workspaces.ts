import { promises as fs } from "node:fs";
import {
  readConfig,
  storeExists,
  workspacePath,
  workspacesPath,
  writeWorkspaceMeta,
  readWorkspaceMeta,
  type WorkspaceMeta,
} from "../lib/store.js";
import { buildMatcher } from "../lib/ignore.js";
import { mirror, type MirrorStats } from "../lib/mirror.js";
import { writeAgentScaffold } from "../lib/scaffold.js";

export interface WorkspaceInfo {
  name: string;
  baseBranch: string | null;
  fileCount: number | null;
  createdAt: string | null;
}

export function validateName(name: string): void {
  if (!/^[A-Za-z0-9._-]+$/.test(name)) {
    throw new Error(`Invalid workspace name "${name}". Use letters, digits, '.', '_', '-'.`);
  }
}

async function pathExists(p: string): Promise<boolean> {
  try {
    await fs.access(p);
    return true;
  } catch {
    return false;
  }
}

/** List workspaces with metadata. Returns [] if the store/workspaces dir is missing. */
export async function listWorkspaces(targetRoot: string): Promise<WorkspaceInfo[]> {
  const dir = workspacesPath(targetRoot);
  let names: string[] = [];
  try {
    names = (await fs.readdir(dir, { withFileTypes: true }))
      .filter((e) => e.isDirectory())
      .map((e) => e.name)
      .sort();
  } catch {
    return [];
  }

  const out: WorkspaceInfo[] = [];
  for (const name of names) {
    const meta = await readWorkspaceMeta(workspacePath(targetRoot, name));
    out.push({
      name,
      baseBranch: meta?.baseBranch ?? null,
      fileCount: meta?.fileCount ?? null,
      createdAt: meta?.createdAt ?? null,
    });
  }
  return out;
}

/**
 * Create a workspace: mirror the project via symlinks, write metadata and the
 * agent scaffold. Throws on invalid name, missing store, or existing workspace.
 */
export async function createWorkspace(
  targetRoot: string,
  name: string,
): Promise<{ dest: string; stats: MirrorStats }> {
  if (!(await storeExists(targetRoot))) {
    throw new Error("No .feverdreams store here. Run `feverdreams init` first.");
  }

  validateName(name);
  const dest = workspacePath(targetRoot, name);
  if (await pathExists(dest)) {
    throw new Error(`Workspace "${name}" already exists.`);
  }

  const config = await readConfig(targetRoot);
  const matcher = await buildMatcher(targetRoot);
  const stats = await mirror(targetRoot, dest, matcher);

  const meta: WorkspaceMeta = {
    name,
    baseBranch: config.baseBranch,
    baseCommit: config.baseCommit,
    sourceRoot: targetRoot,
    createdAt: new Date().toISOString(),
    fileCount: stats.links,
  };
  await writeWorkspaceMeta(dest, meta);
  await writeAgentScaffold(dest, name);

  return { dest, stats };
}

/** Remove a workspace directory. Originals are untouched (only symlinks/copies live here). */
export async function removeWorkspace(targetRoot: string, name: string): Promise<void> {
  const dest = workspacePath(targetRoot, name);
  if (!(await pathExists(dest))) {
    throw new Error(`Workspace "${name}" not found.`);
  }
  await fs.rm(dest, { recursive: true, force: true });
}

/** The instruction to paste to an AI agent so it works inside the workspace. */
export function agentInstruction(dest: string): string {
  return (
    `Work only inside ${dest}. Read and edit files there; ` +
    `your edits become real copies automatically (copy-on-write).`
  );
}
