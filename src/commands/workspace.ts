import { promises as fs } from "node:fs";
import { confirm } from "@inquirer/prompts";
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
import { mirror } from "../lib/mirror.js";
import { writeAgentScaffold } from "../lib/scaffold.js";

function validateName(name: string): void {
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

export async function workspaceCreate(name: string): Promise<void> {
  const targetRoot = process.cwd();

  if (!(await storeExists(targetRoot))) {
    console.error("No .feverdreams store here. Run `feverdreams init` first.");
    process.exitCode = 1;
    return;
  }

  validateName(name);
  const dest = workspacePath(targetRoot, name);
  if (await pathExists(dest)) {
    console.error(`Workspace "${name}" already exists.`);
    process.exitCode = 1;
    return;
  }

  const config = await readConfig(targetRoot);
  const matcher = await buildMatcher(targetRoot);

  console.log(`Creating workspace "${name}"…`);
  const stats = await mirror(targetRoot, dest, matcher);

  const meta: WorkspaceMeta = {
    name,
    baseBranch: config.baseBranch,
    baseCommit: config.baseCommit,
    sourceRoot: targetRoot,
    createdAt: new Date().toISOString(),
  };
  await writeWorkspaceMeta(dest, meta);
  await writeAgentScaffold(dest, name);

  console.log(`✅ Workspace ready: ${dest}`);
  console.log(`   ${stats.links} linked files, ${stats.dirs} dirs, ${stats.skipped} skipped (ignored).`);
  console.log("");
  console.log("Tell your AI agent:");
  console.log(`   "Work only inside ${dest}. Read and edit files there;`);
  console.log(`    your edits become real copies automatically (copy-on-write)."`);
}

export async function workspaceList(): Promise<void> {
  const targetRoot = process.cwd();
  if (!(await storeExists(targetRoot))) {
    console.error("No .feverdreams store here. Run `feverdreams init` first.");
    process.exitCode = 1;
    return;
  }

  const dir = workspacesPath(targetRoot);
  let names: string[] = [];
  try {
    names = (await fs.readdir(dir, { withFileTypes: true }))
      .filter((e) => e.isDirectory())
      .map((e) => e.name);
  } catch {
    // workspaces dir not created yet
  }

  if (names.length === 0) {
    console.log("No workspaces yet. Create one with `feverdreams workspace create <name>`.");
    return;
  }

  for (const n of names) {
    const meta = await readWorkspaceMeta(workspacePath(targetRoot, n));
    const base = meta?.baseBranch ? ` (base: ${meta.baseBranch})` : "";
    console.log(`• ${n}${base}`);
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

  await fs.rm(dest, { recursive: true, force: true });
  console.log(`Removed workspace "${name}".`);
}
