# Contributing to FeverDreams

Thanks for your interest in improving FeverDreams! This is an early-stage
project, so issues, ideas, and pull requests are all welcome.

## Prerequisites

- **Node ≥ 20**
- **macOS or Linux** (Windows symlinks need elevated privileges and aren't
  supported yet)

## Getting started

```bash
npm install        # install dependencies
npm run build      # compile TypeScript to dist/
npm run dev -- <args>   # run the CLI from source via tsx
```

## Checks before opening a PR

Both of these must be green:

```bash
npm run typecheck  # tsc --noEmit
npm test           # vitest
```

CI runs the same steps (`npm ci` → typecheck → build → test) on every push and
pull request.

## Pull request flow

1. Fork the repo (or create a branch if you have push access).
2. Make your change with a focused commit history.
3. Ensure `npm run typecheck` and `npm test` pass.
4. Open a PR describing the change and the motivation.

## Project layout

```
src/
├── cli.ts            # entry point (commander)
├── commands/         # init, workspace, materialize, diff, apply, branch, hook
├── core/             # workspaces, init, apply, diff, branch orchestration
└── lib/              # store, mirror, ignore, git, cow, scaffold
test/                 # vitest integration tests
.claude-plugin/       # plugin.json + marketplace.json (Claude Code plugin)
skills/               # bundled agent skills (feverdreams, new, branch)
AGENTS.md             # portable agent entry point (non-Claude tools)
```

Keep new code consistent with the surrounding style: ESM with `.js` import
extensions, small focused modules, and integration tests on temp directories.

When you change the CLI surface (add/rename a command or flag), keep the
agent-facing docs in sync: `skills/feverdreams/SKILL.md`,
`skills/feverdreams/reference.md`, the `/feverdreams:new` and `/feverdreams:branch`
skills, and `AGENTS.md`.

## Releasing

`package.json` is the single source of truth for the version. The CLI reads it at
runtime (`feverdreams --version`), and the Claude Code plugin files
(`.claude-plugin/plugin.json`, `.claude-plugin/marketplace.json`) are kept in sync by
`scripts/sync-version.mjs`, which runs automatically on bump.

1. Move the `## [Unreleased]` notes in `CHANGELOG.md` under a new version heading.
2. On a clean working tree, run `npm version patch|minor|major`. This bumps
   `package.json`, syncs the plugin files, and creates the version commit **and** git
   tag in one step.
3. `git push --follow-tags`.

To preview the sync without bumping, run `npm run sync-version`.
