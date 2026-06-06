# FeverDreams command reference

| Command | Description |
| --- | --- |
| `feverdreams` | Launch the interactive full-screen UI (requires a TTY). |
| `feverdreams init [-b <branch>] [-f]` | Create the `.feverdreams/` store. `-b` sets the base branch non-interactively (required in agent sessions); `-f` reinitializes an existing store. |
| `feverdreams workspace create <name>` | Mirror the project into a new workspace (real dirs + per-file symlinks), skipping ignored paths. Writes `CLAUDE.md` + a Claude Code PreToolUse hook into the workspace. |
| `feverdreams workspace list` | List workspaces. |
| `feverdreams workspace remove <name> [-y]` | Delete a workspace (`-y` skips confirmation). Originals are untouched. |
| `feverdreams materialize <ws> <path>` | Replace a workspace symlink with a real copy (copy-on-write). Idempotent. Run before editing a file under any non-Claude agent. |
| `feverdreams diff <ws>` | Show files a workspace would change against the base (`M` modified, `A` added). |
| `feverdreams apply <ws> [--run "<cmd>"]` | Apply a workspace's changes onto the base (backs up first, takes the lock). `--run` applies, runs the command, then auto-reverts. |
| `feverdreams revert [ws] [-f]` | Restore the base to pristine and release the lock. `-f`/`--force` clears a stuck lock left by a crashed run. |
| `feverdreams branch <ws> <name> -m "<msg>" [--push]` | Apply the workspace, commit exactly its changed files to a new git branch `<name>`, then return to your branch and restore the base. `-m` (required) is the commit message; `--push` pushes to `origin` (`-u`). |
| `feverdreams status` | Show whether the base currently holds an applied workspace (holder, operation, since). |
| `feverdreams hook run` | PreToolUse hook entry point — reads the tool payload on stdin and materializes the target if needed. |

## Notes & guarantees

- **Single-slot lock.** While one workspace is applied (or being branched), the base
  is busy and no other workspace can be applied. `revert` (and the tail of
  `branch` / `apply --run`) releases it.
- **`branch` refuses up front** if the base repo has uncommitted *tracked* changes,
  isn't a git repo, or the target branch already exists — so it never tangles your
  in-progress work into the commit. Untracked files (including `.feverdreams/`) are
  ignored and never staged: only the workspace's changed files are committed.
- **No deletion tracking.** A workspace diff is modified + added files only; deleting
  a file in a workspace is not reflected on apply/branch.
- **`.feverdreams/`** is a transient store — add it to the project's `.gitignore`.
