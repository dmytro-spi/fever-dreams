import { promises as fs } from "node:fs";
import path from "node:path";
import { workspacePath, WORKSPACE_META_PATHS, type ApplyChange } from "../lib/store.js";
import { buildMatcher } from "../lib/ignore.js";

export interface Change extends ApplyChange {
  /** Absolute path of the changed file inside the workspace. */
  absWs: string;
  /** Absolute path of the corresponding file in the base project. */
  absBase: string;
}

async function pathExists(p: string): Promise<boolean> {
  try {
    await fs.access(p);
    return true;
  } catch {
    return false;
  }
}

/**
 * Compute the set of changes a workspace would apply to the base project.
 *
 * A workspace mirrors the project with symlinks; only **real files** represent
 * changes. A real file whose base counterpart exists and differs is `modified`;
 * one with no base counterpart is `added`. Symlinks, ignored paths, and
 * FeverDreams' own workspace-meta files are skipped.
 */
export async function collectChanges(targetRoot: string, workspaceName: string): Promise<Change[]> {
  const wsRoot = workspacePath(targetRoot, workspaceName);
  if (!(await pathExists(wsRoot))) {
    throw new Error(`Workspace "${workspaceName}" not found.`);
  }

  const matcher = await buildMatcher(targetRoot);
  const changes: Change[] = [];

  async function walk(relDir: string): Promise<void> {
    const absDir = path.join(wsRoot, relDir);
    const entries = await fs.readdir(absDir, { withFileTypes: true });

    for (const entry of entries) {
      const rel = relDir ? path.join(relDir, entry.name) : entry.name;

      // Skip FeverDreams' own workspace files (only at the workspace root).
      if (!relDir && WORKSPACE_META_PATHS.includes(entry.name)) continue;

      const isDir = entry.isDirectory();
      if (matcher.ignores(rel, isDir)) continue;

      if (entry.isSymbolicLink()) {
        // Unchanged: still points at the original.
        continue;
      }

      if (isDir) {
        await walk(rel);
        continue;
      }

      if (!entry.isFile()) continue;

      const absWs = path.join(wsRoot, rel);
      const absBase = path.join(targetRoot, rel);
      const mode = (await fs.stat(absWs)).mode & 0o777;

      if (await pathExists(absBase)) {
        // Modified only if the content actually differs from the base.
        const [wsBuf, baseBuf] = await Promise.all([fs.readFile(absWs), fs.readFile(absBase)]);
        if (wsBuf.equals(baseBuf)) continue;
        changes.push({ rel, action: "modified", mode, absWs, absBase });
      } else {
        changes.push({ rel, action: "added", mode, absWs, absBase });
      }
    }
  }

  await walk("");
  changes.sort((a, b) => a.rel.localeCompare(b.rel));
  return changes;
}
