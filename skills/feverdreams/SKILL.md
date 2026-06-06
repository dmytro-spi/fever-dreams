---
name: feverdreams
description: Do risky or experimental code changes in an isolated copy-on-write workspace instead of editing the project directly. Use when the user wants to try a change safely, sandbox an agent, compare two approaches, or turn experimental work into a git branch without dirtying the base working tree.
---

# FeverDreams: work in an isolated copy-on-write workspace

FeverDreams gives you an isolated **copy of the project that isn't a real copy**.
Files are symlinks to the originals until you edit one, at which point that single
file becomes a real copy (copy-on-write). Each workspace edits only its own files, so
several tasks can run over the same project at once without colliding, and the base
stays the shared source of truth.

## When to reach for this

- The user wants to **work on several tasks in parallel** over one project without
  the changes conflicting — one workspace per task.
- You want an **isolated sandbox** to iterate in, then either apply the result or
  discard it.
- The user wants to **compare two approaches** (one workspace each).
- The user wants to **turn a task's work into a git branch** without dirtying the
  shared working tree.

## Prerequisite

`feverdreams` must be on PATH (the project is installed via `npm link` or
`npm install -g`). Initialize the store once per project:

```bash
feverdreams init -b <base-branch>
```

Always pass `-b` — without it, `init` prompts interactively for the base branch and
will hang/abort in a non-TTY agent session.

## Workflow

1. **Create a workspace**
   ```bash
   feverdreams workspace create <name>
   ```
   Work then happens under `.feverdreams/workspaces/<name>`.

2. **⚠️ CoW safety rule — materialize before editing (critical)**
   A workspace file is a symlink to the original. **Editing it through the symlink
   writes straight to the original project.** Before editing ANY file, turn it into a
   real copy first:
   ```bash
   feverdreams materialize <name> <path/relative/to/workspace>
   ```
   Under **Claude Code**, a `PreToolUse` hook in the workspace does this automatically
   on every Edit/Write/MultiEdit — you don't need to. Under **any other agent/tool**
   you MUST run `materialize` first. Always stay inside the workspace directory.

3. **Inspect the diff**
   ```bash
   feverdreams diff <name>      # M = modified, A = added
   ```

4. **Land the work** — pick one:
   ```bash
   feverdreams apply <name>                  # copy changes onto the base (backs up, takes the lock)
   feverdreams revert                         # restore the base, release the lock
   feverdreams apply <name> --run "npm test"  # one-shot: apply → run → auto-revert
   feverdreams branch <name> <branch> -m "msg" [--push]   # commit only the changed files to a new branch, then restore base
   ```

5. **Lock** — only one workspace can be applied at a time.
   ```bash
   feverdreams status                 # who currently holds the base
   feverdreams revert --force         # clear a stuck lock left by a crashed run
   ```

Full command reference: [reference.md](reference.md).
