import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";

import { buildMatcher } from "../src/lib/ignore.js";
import { mirror } from "../src/lib/mirror.js";
import { materialize } from "../src/lib/cow.js";
import { initCommand } from "../src/commands/init.js";
import { workspaceCreate } from "../src/commands/workspace.js";
import { initStore } from "../src/core/init.js";
import { createWorkspace, listWorkspaces, removeWorkspace } from "../src/core/workspaces.js";
import { readConfig, workspacePath, storeExists } from "../src/lib/store.js";

let tmp: string;
let cwd: string;

async function makeProject(root: string): Promise<void> {
  await fs.mkdir(path.join(root, "src"), { recursive: true });
  await fs.mkdir(path.join(root, "node_modules", "left-pad"), { recursive: true });
  await fs.writeFile(path.join(root, "src", "index.ts"), "export const x = 1;\n");
  await fs.writeFile(path.join(root, "package.json"), '{ "name": "demo" }\n');
  await fs.writeFile(path.join(root, ".gitignore"), "secret.txt\n");
  await fs.writeFile(path.join(root, "secret.txt"), "shh\n");
  await fs.writeFile(path.join(root, "node_modules", "left-pad", "index.js"), "module.exports = 1;\n");
}

beforeEach(async () => {
  cwd = process.cwd();
  // realpath: on macOS /tmp is a symlink to /private/tmp, and process.cwd()
  // returns the resolved path — normalize so comparisons match.
  tmp = await fs.realpath(await fs.mkdtemp(path.join(os.tmpdir(), "multiverse-test-")));
  await makeProject(tmp);
  process.chdir(tmp);
});

afterEach(async () => {
  process.chdir(cwd);
  await fs.rm(tmp, { recursive: true, force: true });
});

describe("ignore matcher", () => {
  it("skips node_modules, .git, and .gitignore entries", async () => {
    const m = await buildMatcher(tmp);
    expect(m.ignores("node_modules", true)).toBe(true);
    expect(m.ignores(".git", true)).toBe(true);
    expect(m.ignores("secret.txt", false)).toBe(true);
    expect(m.ignores("src", true)).toBe(false);
    expect(m.ignores("src/index.ts", false)).toBe(false);
  });
});

describe("mirror", () => {
  it("creates real dirs + per-file symlinks and skips ignored paths", async () => {
    const dest = path.join(tmp, "out");
    const m = await buildMatcher(tmp);
    const stats = await mirror(tmp, dest, m);

    // node_modules and secret.txt skipped
    await expect(fs.access(path.join(dest, "node_modules"))).rejects.toThrow();
    await expect(fs.access(path.join(dest, "secret.txt"))).rejects.toThrow();

    // src is a real directory
    const srcStat = await fs.lstat(path.join(dest, "src"));
    expect(srcStat.isDirectory()).toBe(true);

    // index.ts is a symlink pointing to the original
    const fileStat = await fs.lstat(path.join(dest, "src", "index.ts"));
    expect(fileStat.isSymbolicLink()).toBe(true);
    const target = await fs.realpath(path.join(dest, "src", "index.ts"));
    expect(target).toBe(await fs.realpath(path.join(tmp, "src", "index.ts")));

    expect(stats.links).toBeGreaterThanOrEqual(2);
    expect(stats.skipped).toBeGreaterThanOrEqual(1);
  });
});

describe("copy-on-write materialize", () => {
  it("turns a symlink into a real copy without touching the original", async () => {
    const dest = path.join(tmp, "out");
    const m = await buildMatcher(tmp);
    await mirror(tmp, dest, m);

    const link = path.join(dest, "src", "index.ts");
    const original = path.join(tmp, "src", "index.ts");

    const res = await materialize(link);
    expect(res.status).toBe("materialized");

    // now a real file, not a symlink
    expect((await fs.lstat(link)).isSymbolicLink()).toBe(false);

    // editing the copy does not affect the original
    await fs.writeFile(link, "export const x = 999;\n");
    expect(await fs.readFile(original, "utf8")).toBe("export const x = 1;\n");
    expect(await fs.readFile(link, "utf8")).toBe("export const x = 999;\n");
  });

  it("is idempotent and reports already-real / missing", async () => {
    const dest = path.join(tmp, "out");
    await mirror(tmp, dest, await buildMatcher(tmp));
    const link = path.join(dest, "package.json");

    expect((await materialize(link)).status).toBe("materialized");
    expect((await materialize(link)).status).toBe("already-real");
    expect((await materialize(path.join(dest, "nope.txt"))).status).toBe("missing");
  });
});

describe("init + workspace create (e2e via cwd)", () => {
  it("init in a non-git dir writes config without prompting", async () => {
    await initCommand({});
    expect(await storeExists(tmp)).toBe(true);
    const config = await readConfig(tmp);
    expect(config.baseBranch).toBeNull();
    expect(config.targetRoot).toBe(tmp);
  });

  it("workspace create mirrors project and writes agent scaffold", async () => {
    await initCommand({});
    await workspaceCreate("ws1");

    const wsDir = workspacePath(tmp, "ws1");
    expect((await fs.lstat(path.join(wsDir, "src", "index.ts"))).isSymbolicLink()).toBe(true);
    await expect(fs.access(path.join(wsDir, "node_modules"))).rejects.toThrow();
    await expect(fs.access(path.join(wsDir, "CLAUDE.md"))).resolves.toBeUndefined();
    await expect(fs.access(path.join(wsDir, ".claude", "settings.json"))).resolves.toBeUndefined();

    const settings = JSON.parse(await fs.readFile(path.join(wsDir, ".claude", "settings.json"), "utf8"));
    expect(settings.hooks.PreToolUse[0].matcher).toBe("Edit|Write|MultiEdit");
  });
});

describe("core workspaces (used by the interactive UI)", () => {
  it("createWorkspace records fileCount and listWorkspaces returns it", async () => {
    await initStore(tmp, {});
    const { stats } = await createWorkspace(tmp, "ws1");

    const list = await listWorkspaces(tmp);
    expect(list).toHaveLength(1);
    expect(list[0].name).toBe("ws1");
    expect(list[0].fileCount).toBe(stats.links);
    expect(list[0].fileCount).toBeGreaterThanOrEqual(2);

    await expect(createWorkspace(tmp, "ws1")).rejects.toThrow(/already exists/);

    await removeWorkspace(tmp, "ws1");
    expect(await listWorkspaces(tmp)).toHaveLength(0);
  });
});
