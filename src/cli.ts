#!/usr/bin/env node
import { Command } from "commander";
import { initCommand } from "./commands/init.js";
import { workspaceCreate, workspaceList, workspaceRemove } from "./commands/workspace.js";
import { materializeCommand } from "./commands/materialize.js";
import { applyCommand, revertCommand, statusCommand } from "./commands/apply.js";
import { diffCommand } from "./commands/diff.js";
import { hookRun } from "./commands/hook.js";

const program = new Command();

program
  .name("feverdreams")
  .description("FeverDreams — copy-on-write AI agent workspaces over your project")
  .version("0.1.0")
  .action(async () => {
    // Bare `feverdreams` (no subcommand) launches the interactive UI.
    // Dynamic import keeps Ink off the hot path of `hook run` and other commands.
    const { runUI } = await import("./ui/run.js");
    await runUI();
  });

program
  .command("init")
  .description("Initialize the .feverdreams store in the current folder")
  .option("-f, --force", "Reinitialize if a store already exists")
  .option("-b, --branch <name>", "Base git branch (skips the interactive prompt)")
  .action((opts) => initCommand(opts));

const ws = program
  .command("workspace")
  .alias("ws")
  .description("Manage workspaces");

ws.command("create <name>")
  .description("Create a workspace mirroring the project via symlinks")
  .action((name) => workspaceCreate(name));

ws.command("list")
  .description("List existing workspaces")
  .action(() => workspaceList());

ws.command("remove <name>")
  .description("Remove a workspace (original project files are untouched)")
  .option("-y, --yes", "Skip the confirmation prompt")
  .action((name, opts) => workspaceRemove(name, opts));

program
  .command("materialize <workspace> <path>")
  .description("Replace a workspace symlink with a real copy (copy-on-write)")
  .action((workspace, p) => materializeCommand(workspace, p));

program
  .command("diff <workspace>")
  .description("Show files a workspace would change against the base (M modified, A added)")
  .action((workspace) => diffCommand(workspace));

program
  .command("apply <workspace>")
  .description("Apply a workspace's changes onto the base project (backs up first)")
  .option("--run <cmd>", "Run a command against the applied base, then auto-revert")
  .action((workspace, opts) => applyCommand(workspace, opts));

program
  .command("revert [workspace]")
  .description("Restore the base to its pristine state and clear the apply session")
  .option("-f, --force", "Force-release a stuck lock even if no manifest is present")
  .action((workspace, opts) => revertCommand(workspace, opts));

program
  .command("status")
  .description("Show whether the base currently holds an applied workspace")
  .action(() => statusCommand());

const hook = program.command("hook").description("Claude Code hook integration");

hook
  .command("run")
  .description("PreToolUse hook: materialize a symlink before edits (reads JSON on stdin)")
  .action(() => hookRun());

program.parseAsync(process.argv).catch((err) => {
  console.error(err instanceof Error ? err.message : String(err));
  process.exit(1);
});
