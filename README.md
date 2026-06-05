# FeverDreams

> Copy-on-write AI agent workspaces over your project.

FeverDreams is a terminal app that lets an AI agent (or you) work on an isolated
**copy of your project without actually copying it**. Each workspace mirrors your
files as symlinks; the moment a file is *edited*, that one file is turned into a
real copy (copy-on-write). Your original project is never touched.

Run `feverdreams` for an interactive, arrow-key-driven UI, or use the individual
subcommands for scripting.

## Why

When an AI agent edits files in place, a bad change can corrupt your working tree.
Full copies of a repo are slow and waste disk (think `node_modules`). FeverDreams
gives each agent a cheap, isolated workspace:

- **Reads** pass straight through to the originals (symlinks) — zero copy cost.
- **Writes** trigger copy-on-write — only modified files become real copies.
- The original project stays pristine; throw a workspace away with no consequences.

## How it works

```
your-project/                      .feverdreams/workspaces/ws1/
├── src/app.ts        ──read──▶     ├── src/app.ts  → symlink → your-project/src/app.ts
├── package.json                    ├── package.json → symlink → ...
└── node_modules/  (skipped)        └── (no node_modules — ignored)

agent edits src/app.ts in ws1
        │
        ▼  copy-on-write
ws1/src/app.ts  becomes a REAL FILE (copy)   ← original src/app.ts unchanged
```

Copy-on-write is triggered two ways:

1. **`feverdreams materialize`** — an explicit primitive (agent-agnostic).
2. **Claude Code hook** — every new workspace ships a `.claude/settings.json` with a
   `PreToolUse` hook that runs `feverdreams hook run` before any `Edit`/`Write`/
   `MultiEdit`, materializing the symlink automatically. The agent does nothing
   special.

## Install

Requires **Node ≥ 20** (macOS / Linux).

```bash
npm install
npm run build
npm link            # exposes the `feverdreams` command on your PATH
```

> The Claude Code hook calls `feverdreams hook run`, so the command must be on
> PATH (`npm link` or `npm install -g`).

## Usage

### Interactive UI

Run `feverdreams` with **no arguments** to open the full-screen terminal UI — the
easiest way to drive everything. It's an always-running app (built with
[Ink](https://github.com/vadimdemedes/ink)); navigate with the arrow keys.

```
╭─ FeverDreams ─────────────────────────────╮
│ store: .feverdreams   base: main @ 7f62d93 │
╰────────────────────────────────────────────╯
 Workspaces (2)
 ❯ ws1   3 files · base main
   ws2   5 files · base main
 ↑↓ move   ↵ open   n new   m materialize   d delete   r reload   q quit
```

| Key | Action |
| --- | --- |
| `↑` / `↓` | Move the selection |
| `↵` | Open the selected workspace (path + ready-to-paste agent instruction) |
| `n` | Create a new workspace (prompts for a name) |
| `m` | Copy-on-write a file in the selected workspace (prompts for a path) |
| `d` | Delete the selected workspace (confirm with `y`) |
| `r` | Reload the list |
| `i` | Initialize the store (shown when the folder has none; picks a base branch) |
| `q` / `Ctrl-C` | Quit · `esc` cancels a prompt or goes back |

The UI requires an interactive terminal (TTY). Piped or non-interactive
invocations print a hint and fall back to the subcommands below.

### Scripting / subcommands

Every action is also a plain subcommand, for automation or non-TTY environments:

```bash
# 1. Initialize the store in your project (pick a base git branch if it's a repo)
cd your-project
feverdreams init

# 2. Create an isolated workspace (mirrors the project via symlinks)
feverdreams workspace create ws1

# 3. Point your AI agent at the printed workspace path:
#    .feverdreams/workspaces/ws1
#    It reads files normally; edits become real copies automatically.

# Manage workspaces
feverdreams workspace list
feverdreams workspace remove ws1

# Copy-on-write a file by hand (usually the hook does this for you)
feverdreams materialize ws1 src/app.ts
```

## Commands

| Command | Description |
| --- | --- |
| `feverdreams` | Launch the interactive full-screen UI (requires a TTY). |
| `feverdreams init` | Create the `.feverdreams/` store. In a git repo, prompts for the base branch (use `-b <name>` to skip, `-f` to reinitialize). |
| `feverdreams workspace create <name>` | Mirror the project into a new workspace (real dirs + per-file symlinks), skipping ignored paths. Writes `CLAUDE.md` + a Claude Code hook. |
| `feverdreams workspace list` | List workspaces. |
| `feverdreams workspace remove <name>` | Delete a workspace (`-y` to skip confirmation). Originals are untouched. |
| `feverdreams materialize <ws> <path>` | Replace a workspace symlink with a real copy (copy-on-write). Idempotent. |
| `feverdreams hook run` | PreToolUse hook entry point — reads the tool payload on stdin and materializes the target if needed. |

## What gets mirrored

Directories become **real directories**; files become **symlinks** to the absolute
original. Skipped: a built-in denylist (`node_modules`, `.git`, `.feverdreams`,
`dist`, `build`, `.next`, `out`, `coverage`, `.cache`, `.turbo`, `.venv`,
`__pycache__`, `target`, `vendor`, `.DS_Store`) plus everything in the project's
`.gitignore`.

## Store layout

```
.feverdreams/
├── config.json                 # base branch + commit, target root, created_at
└── workspaces/
    └── ws1/
        ├── .workspace.json      # workspace metadata
        ├── CLAUDE.md            # scope instruction for the agent
        ├── .claude/settings.json# PreToolUse copy-on-write hook
        └── <project mirror>     # real dirs + file symlinks
```

## Development

```bash
npm run dev -- <args>   # run from source via tsx
npm run typecheck       # tsc --noEmit
npm test                # vitest
npm run build           # compile to dist/
```

## Scope

Current scope: `init`, workspace create/list/remove, and copy-on-write. Out of
scope for now: applying changes back to the base branch, diffing, lock-based
coordination between agents, Windows, and non-Node projects (these may work but
aren't polished).

## Contributing

Contributions are welcome — see [CONTRIBUTING.md](./CONTRIBUTING.md).

## License

MIT — see [LICENSE](./LICENSE).
