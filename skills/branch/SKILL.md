---
name: branch
description: Apply a FeverDreams workspace and commit it to a new git branch.
argument-hint: [workspace] [branch-name] [-m "message"] [--push]
disable-model-invocation: true
---

# Branch a FeverDreams workspace

Commit a workspace's changes to a brand-new git branch, then return the base repo to
its original branch and pristine working tree.

From `$ARGUMENTS`, determine the workspace name, the new branch name, the commit
message, and whether to push. If the commit message is missing, ask for one (it is
required). Then run:

```bash
feverdreams branch <workspace> <branch-name> -m "<message>" [--push]
```

This applies the workspace under the lock, creates `<branch-name>`, commits **only**
the workspace's changed files (never `.feverdreams/` or unrelated files), optionally
pushes to `origin -u`, then checks back out to the original branch and restores the
base.

Report the created branch, the base branch it returned to, and the file count. If
`--push` was requested and the push failed, surface the error and tell the user they
can push manually with `git push -u origin <branch-name>` — the local branch and
commit are kept.

`branch` refuses up front if the base repo has uncommitted tracked changes, isn't a
git repo, or the branch already exists; relay that error if it occurs.
