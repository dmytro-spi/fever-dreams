# Changelog

All notable changes to FeverDreams are documented here.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [0.1.0]

Initial release.

### Added
- `init` — create the `.feverdreams/` store (base branch via `-b`, `-f` to reinitialize).
- Workspaces — `workspace create` / `list` / `remove`: mirror the project as real dirs +
  per-file symlinks, skipping ignored paths.
- Copy-on-write — `materialize` primitive, plus a per-workspace Claude Code `PreToolUse`
  hook (`feverdreams hook run`) that materializes a file before any Edit/Write/MultiEdit.
- `diff` — show the files a workspace would change against the base (M modified, A added).
- `apply` / `revert` — copy a workspace's changes onto the base (with backups) and restore
  it, guarded by a single-slot lock; `apply --run "<cmd>"` for one-shot apply→run→revert;
  `revert --force` to clear a stuck lock. `status` reports the current holder.
- `branch` — commit exactly a workspace's changed files to a new git branch, then return
  to the original branch and restore the base; `-m` message (required), optional `--push`.
- Interactive full-screen UI (Ink) for driving all of the above.
- Claude Code plugin + skills (`feverdreams`, `/feverdreams:new`, `/feverdreams:branch`)
  and a portable `AGENTS.md` for non-Claude agents.

[Unreleased]: https://github.com/dmytro-spi/fever-dreams/compare/v0.1.0...HEAD
[0.1.0]: https://github.com/dmytro-spi/fever-dreams/releases/tag/v0.1.0
