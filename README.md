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

## Landing the work: apply, branch, lock

A workspace is throwaway by design — but when an agent's changes are good, you
need a way to get them out. FeverDreams offers two paths, both built on a
**file-level snapshot** of the workspace's diff (modified + added files):

- **`apply`** copies the diff onto the base working tree (backing up every file it
  overwrites) so you can test it in place, then **`revert`** restores the base
  exactly. `apply --run "<cmd>"` does a one-shot apply → run → revert.
- **`branch`** applies the diff, commits exactly those files to a **new git
  branch**, optionally pushes, then checks back out to the branch you were on and
  restores the base — leaving you with a clean branch and a pristine working tree.
  Only the changed files are staged, so `.feverdreams/` is never committed.

Both operations run under a single **lock**: while one workspace is applied (or
being branched), the base is marked busy and no other workspace can be applied.
The lock is released on `revert` (and automatically at the end of `branch` /
`apply --run`). `feverdreams status` shows who holds it; a stuck lock from a
crashed run can be cleared with `feverdreams revert --force`.

`branch` refuses up front if the base repo has **uncommitted tracked changes**,
isn't a git repo, or the target branch already exists — so it never tangles your
in-progress work into the commit.

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
 ↑↓ move  ↵ open  n new  m materialize  a apply  b branch  v revert  d delete  q quit
```

| Key | Action |
| --- | --- |
| `↑` / `↓` | Move the selection |
| `↵` | Open the selected workspace (path + ready-to-paste agent instruction) |
| `n` | Create a new workspace (prompts for a name) |
| `m` | Copy-on-write a file in the selected workspace (prompts for a path) |
| `a` | Apply the selected workspace's changes onto the base (takes the lock) |
| `b` | Commit the selected workspace to a new git branch (prompts for branch name + message) |
| `v` | Revert the base to pristine and release the lock |
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

# 4. See what a workspace would change against the base
feverdreams diff ws1

# 5a. Apply the workspace onto the base to try it (backs up first, takes the lock)
feverdreams apply ws1
feverdreams status            # who holds the base right now
feverdreams revert            # restore the base to pristine, release the lock

# 5b. Or run a command against the applied base and auto-revert afterwards
feverdreams apply ws1 --run "npm test"

# 6. Land the work as a git branch (apply → commit → return to your branch)
feverdreams branch ws1 my-feature -m "feat: my feature"
feverdreams branch ws1 my-feature -m "feat: my feature" --push   # also push to origin
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
| `feverdreams diff <ws>` | Show the files a workspace would change against the base (`M` modified, `A` added). |
| `feverdreams apply <ws>` | Apply a workspace's changes onto the base (backs up first, takes the lock). `--run "<cmd>"` applies, runs the command, then auto-reverts. |
| `feverdreams revert [ws]` | Restore the base to pristine and release the lock. `-f`/`--force` clears a stuck lock left by a crashed run. |
| `feverdreams branch <ws> <name>` | Apply the workspace, commit exactly its files to a new git branch `<name>`, then return to your branch and restore the base. `-m <msg>` (required) sets the commit message; `--push` pushes to `origin`. |
| `feverdreams status` | Show whether the base currently holds an applied workspace (holder, operation, since). |
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
├── apply-session/              # present only while a workspace is applied (the lock)
│   ├── lock.json               # "base is busy" marker + holder (pid/host/session)
│   ├── manifest.json           # what was applied, so revert can undo it
│   └── backup/                 # originals of every base file that was overwritten
└── workspaces/
    └── ws1/
        ├── .workspace.json      # workspace metadata
        ├── CLAUDE.md            # scope instruction for the agent
        ├── .claude/settings.json# PreToolUse copy-on-write hook
        └── <project mirror>     # real dirs + file symlinks
```

> Add `.feverdreams/` to your project's `.gitignore` — it's a transient store,
> not something to commit.

## Development

```bash
npm run dev -- <args>   # run from source via tsx
npm run typecheck       # tsc --noEmit
npm test                # vitest
npm run build           # compile to dist/
```

## Scope

Current scope: `init`, workspace create/list/remove, copy-on-write, `diff`,
`apply`/`revert` (with backups and a single-slot lock), and `branch` (commit a
workspace to a new git branch, optionally pushing).

Out of scope for now: applying more than one workspace at a time (the lock is
intentionally single-slot), reverting file *deletions* made in a workspace
(only modified + added files are tracked), TTL/heartbeat auto-release of a stuck
lock (recover manually with `revert --force`), cross-host lock detection,
Windows, and non-Node projects (these may work but aren't polished).

## Contributing

Contributions are welcome — see [CONTRIBUTING.md](./CONTRIBUTING.md).

## License

MIT — see [LICENSE](./LICENSE).
