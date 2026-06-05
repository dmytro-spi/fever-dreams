import { promises as fs } from "node:fs";
import path from "node:path";

/**
 * Write the agent-facing scaffolding into a freshly created workspace:
 *  - CLAUDE.md: scope instruction for the AI agent;
 *  - .claude/settings.json: a PreToolUse hook that runs `feverdreams hook run`
 *    before Edit/Write/MultiEdit, so symlinks are materialized (copy-on-write)
 *    automatically — the agent does nothing special.
 */
export async function writeAgentScaffold(workspaceDir: string, name: string): Promise<void> {
  const claudeMd = `# Workspace: ${name}

You are working inside an isolated **FeverDreams workspace**.

- This directory mirrors the project via symlinks to the original files.
- **Read** files normally — they resolve to the originals.
- When you **edit** a file, it is automatically turned into a real copy
  (copy-on-write). The original project files are never modified.
- Stay inside this workspace directory. Do not edit files outside it.
`;
  await fs.writeFile(path.join(workspaceDir, "CLAUDE.md"), claudeMd, "utf8");

  const claudeDir = path.join(workspaceDir, ".claude");
  await fs.mkdir(claudeDir, { recursive: true });

  const settings = {
    hooks: {
      PreToolUse: [
        {
          matcher: "Edit|Write|MultiEdit",
          hooks: [{ type: "command", command: "feverdreams hook run" }],
        },
      ],
    },
  };
  await fs.writeFile(
    path.join(claudeDir, "settings.json"),
    JSON.stringify(settings, null, 2) + "\n",
    "utf8",
  );
}
