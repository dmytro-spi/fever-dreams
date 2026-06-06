# FeverDreams for AI agents

FeverDreams gives you an isolated **copy-on-write workspace** over a project: a copy
that isn't really a copy. Files start as symlinks to the originals; the moment you
edit one it becomes a real copy. Each workspace edits only its own files, so several
tasks can run over the same project at once without colliding, and the base stays the
shared source of truth.

This file is the portable entry point for any agent/tool. **Claude Code** users get
the same workflow as an installable plugin (see "Claude Code plugin" below) with a
model-invocable skill and `/feverdreams:*` commands.

## Prerequisite

`feverdreams` must be on PATH (`npm link` or `npm install -g`). Initialize once per
project, always with `-b` (the prompt hangs in a non-TTY session):

```bash
feverdreams init -b <base-branch>
```

## Workflow

1. **Create a workspace** — `feverdreams workspace create <name>`. Work happens under
   `.feverdreams/workspaces/<name>`.

2. **⚠️ Materialize before editing (critical).** A workspace file is a symlink to the
   original — editing it through the symlink writes to the **original project**. Before
   editing ANY file, make it a real copy first:
   ```bash
   feverdreams materialize <name> <path/relative/to/workspace>
   ```
   Under Claude Code a workspace PreToolUse hook does this automatically. Under every
   other tool you MUST run `materialize` first. Stay inside the workspace directory.

3. **Inspect** — `feverdreams diff <name>` (M modified, A added).

4. **Land the work**
   - `feverdreams apply <name>` then `feverdreams revert` — test on the base in place.
   - `feverdreams apply <name> --run "<cmd>"` — one-shot apply → run → auto-revert.
   - `feverdreams branch <name> <branch> -m "<msg>" [--push]` — commit only the changed
     files to a new git branch, then restore the base.

5. **Lock** — one workspace applied at a time. `feverdreams status` shows the holder;
   `feverdreams revert --force` clears a stuck lock.

Full command table: [`skills/feverdreams/reference.md`](skills/feverdreams/reference.md).
The portable skill body lives at [`skills/feverdreams/SKILL.md`](skills/feverdreams/SKILL.md).

## Claude Code plugin

```
/plugin marketplace add dmytro-spi/fever-dreams
/plugin install feverdreams@feverdreams
/reload-plugins
```

Then the `feverdreams` skill auto-applies when relevant, and `/feverdreams:new` /
`/feverdreams:branch` are available as explicit commands.
