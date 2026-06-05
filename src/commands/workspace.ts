import { confirm } from "@inquirer/prompts";
import { storeExists, workspacePath } from "../lib/store.js";
import {
  createWorkspace,
  listWorkspaces,
  removeWorkspace,
  agentInstruction,
} from "../core/workspaces.js";

async function pathExists(p: string): Promise<boolean> {
  const { promises: fs } = await import("node:fs");
  try {
    await fs.access(p);
    return true;
  } catch {
    return false;
  }
}

export async function workspaceCreate(name: string): Promise<void> {
  const targetRoot = process.cwd();

  try {
    console.log(`Creating workspace "${name}"…`);
    const { dest, stats } = await createWorkspace(targetRoot, name);

    console.log(`✅ Workspace ready: ${dest}`);
    console.log(
      `   ${stats.links} linked files, ${stats.dirs} dirs, ${stats.skipped} skipped (ignored).`,
    );
    console.log("");
    console.log("Tell your AI agent:");
    console.log(`   "${agentInstruction(dest)}"`);
  } catch (err) {
    console.error(err instanceof Error ? err.message : String(err));
    process.exitCode = 1;
  }
}

export async function workspaceList(): Promise<void> {
  const targetRoot = process.cwd();
  if (!(await storeExists(targetRoot))) {
    console.error("No .feverdreams store here. Run `feverdreams init` first.");
    process.exitCode = 1;
    return;
  }

  const workspaces = await listWorkspaces(targetRoot);
  if (workspaces.length === 0) {
    console.log("No workspaces yet. Create one with `feverdreams workspace create <name>`.");
    return;
  }

  for (const ws of workspaces) {
    const base = ws.baseBranch ? ` (base: ${ws.baseBranch})` : "";
    console.log(`• ${ws.name}${base}`);
  }
}

export async function workspaceRemove(name: string, opts: { yes?: boolean }): Promise<void> {
  const targetRoot = process.cwd();
  const dest = workspacePath(targetRoot, name);

  if (!(await pathExists(dest))) {
    console.error(`Workspace "${name}" not found.`);
    process.exitCode = 1;
    return;
  }

  if (!opts.yes) {
    const ok = await confirm({
      message: `Remove workspace "${name}"? (original project files are untouched)`,
      default: false,
    });
    if (!ok) {
      console.log("Aborted.");
      return;
    }
  }

  await removeWorkspace(targetRoot, name);
  console.log(`Removed workspace "${name}".`);
}
