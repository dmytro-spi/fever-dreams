---
name: new
description: Create a new FeverDreams copy-on-write workspace and start working in it.
argument-hint: [workspace-name]
disable-model-invocation: true
---

# Create a FeverDreams workspace

Create a new isolated copy-on-write workspace and begin working in it.

1. Ensure the store exists. If `feverdreams init` hasn't been run, run
   `feverdreams init -b <base-branch>` first (always pass `-b` — the prompt hangs in a
   non-TTY session).

2. Create the workspace. Use `$ARGUMENTS` as the name; if empty, pick a short,
   descriptive kebab-case name for the task at hand:
   ```bash
   feverdreams workspace create $ARGUMENTS
   ```

3. Report the workspace path (`.feverdreams/workspaces/<name>`) and switch to working
   inside it.

4. **CoW safety rule:** files in the workspace are symlinks to the originals. Before
   editing any file, run `feverdreams materialize <name> <path>` to make it a real copy
   — otherwise the edit writes to the original. (Under Claude Code the workspace's
   PreToolUse hook does this automatically.) Stay inside the workspace directory.

When the change is ready, inspect it with `feverdreams diff <name>` and land it with
`feverdreams apply` / `feverdreams branch` (see the `feverdreams` skill).
