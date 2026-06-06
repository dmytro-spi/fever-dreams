# Security Policy

## Supported Versions

FeverDreams is in early development (currently `0.1.x`). Security fixes are
applied to the **latest minor release** only. Older versions are not patched.

| Version | Supported          |
| ------- | ------------------ |
| `0.1.x` | :white_check_mark: |
| `< 0.1` | :x:                |

## Reporting a Vulnerability

**Please do not open a public GitHub issue for security problems.**

Report privately via one of these channels — both reach the maintainer:

- **Email:** hello@dispivak.com
- **GitHub private vulnerability report:** go to the repository's
  [Security tab](https://github.com/dmytro-spi/fever-dreams/security/advisories/new)
  and click "Report a vulnerability".

Please include:

1. A clear description of the issue and its impact.
2. Steps to reproduce, or a proof-of-concept if possible.
3. The version of FeverDreams affected (`feverdreams --version`).
4. Your operating system and Node.js version.
5. Whether you'd like to be credited in the advisory.

## What to Expect

- **Acknowledgement** within 3 business days.
- An initial assessment within 7 days, with a plan for a fix or a request for
  more information.
- A fix is released as a patch version; for serious issues, a security advisory
  is published on GitHub alongside the fix.
- You will be kept informed of progress and credited in the advisory unless you
  ask to remain anonymous.

## Scope

Things worth reporting:

- Anything that lets a workspace write through a symlink when it shouldn't
  (escaping the workspace, overwriting the base project, following symlinks
  outside the project root).
- Race conditions or lock-escape issues in `apply` / `branch` that let two
  workspaces modify the base concurrently.
- Path-traversal or command-injection in the Claude Code hook payload parser
  (`feverdreams hook run`).
- Unsafe handling of `.gitignore` / `ignore`-library patterns that could cause
  files outside the project to be mirrored.
- Supply-chain issues in dependencies shipped via `npm install` / `npm link`.

Out of scope: bugs in the host operating system, third-party Claude Code
plugin behavior we don't control, and issues only reproducible with malicious
local user input on a system the reporter already controls.
