import { execFile } from "node:child_process";
import { promisify } from "node:util";

const pexec = promisify(execFile);

export async function isGitRepo(cwd: string): Promise<boolean> {
  try {
    const { stdout } = await pexec("git", ["rev-parse", "--is-inside-work-tree"], { cwd });
    return stdout.trim() === "true";
  } catch {
    return false;
  }
}

export async function currentBranch(cwd: string): Promise<string | null> {
  try {
    const { stdout } = await pexec("git", ["rev-parse", "--abbrev-ref", "HEAD"], { cwd });
    const branch = stdout.trim();
    return branch === "HEAD" ? null : branch;
  } catch {
    return null;
  }
}

export async function listBranches(cwd: string): Promise<string[]> {
  try {
    const { stdout } = await pexec("git", ["branch", "--format=%(refname:short)"], { cwd });
    return stdout
      .split("\n")
      .map((s) => s.trim())
      .filter(Boolean);
  } catch {
    return [];
  }
}

export async function branchCommit(cwd: string, branch: string): Promise<string | null> {
  try {
    const { stdout } = await pexec("git", ["rev-parse", branch], { cwd });
    return stdout.trim();
  } catch {
    return null;
  }
}

// --- Write operations -------------------------------------------------------
// Unlike the read helpers above (which swallow errors and return null/[]), these
// THROW on failure so callers can roll back. Errors are normalized to the git
// stderr message where available.

function gitError(action: string, err: unknown): Error {
  const e = err as { stderr?: string; message?: string };
  const detail = (e.stderr || e.message || String(err)).trim();
  return new Error(`git ${action} failed: ${detail}`);
}

/**
 * True iff there are no staged or unstaged changes to TRACKED files. Untracked
 * files are ignored on purpose: the `.feverdreams` store (and any other untracked
 * files) are never staged by the branch flow, so they can't be entangled in the
 * commit. Tracked changes, however, would be carried onto the branch — we refuse
 * on those.
 */
export async function isClean(cwd: string): Promise<boolean> {
  const { stdout } = await pexec(
    "git",
    ["status", "--porcelain", "--untracked-files=no"],
    { cwd },
  );
  return stdout.trim() === "";
}

/** True iff a local branch with this name already exists. */
export async function branchExists(cwd: string, name: string): Promise<boolean> {
  try {
    await pexec("git", ["rev-parse", "--verify", "--quiet", `refs/heads/${name}`], { cwd });
    return true;
  } catch {
    return false;
  }
}

/** True iff a remote with this name is configured. */
export async function hasRemote(cwd: string, name = "origin"): Promise<boolean> {
  try {
    const { stdout } = await pexec("git", ["remote"], { cwd });
    return stdout.split("\n").map((s) => s.trim()).includes(name);
  } catch {
    return false;
  }
}

/** Create and switch to a new branch off the current HEAD. */
export async function createBranch(cwd: string, name: string): Promise<void> {
  try {
    await pexec("git", ["checkout", "-b", name], { cwd });
  } catch (err) {
    throw gitError(`checkout -b ${name}`, err);
  }
}

/** Stage exactly the given paths (relative to the repo root). */
export async function stageFiles(cwd: string, files: string[]): Promise<void> {
  if (files.length === 0) return;
  try {
    await pexec("git", ["add", "--", ...files], { cwd });
  } catch (err) {
    throw gitError("add", err);
  }
}

/** Commit the staged changes with the given message. */
export async function commit(cwd: string, message: string): Promise<void> {
  try {
    await pexec("git", ["commit", "-m", message], { cwd });
  } catch (err) {
    throw gitError("commit", err);
  }
}

/** Push a branch to a remote, setting upstream. */
export async function pushBranch(cwd: string, branch: string, remote = "origin"): Promise<void> {
  try {
    await pexec("git", ["push", "-u", remote, branch], { cwd });
  } catch (err) {
    throw gitError(`push ${remote} ${branch}`, err);
  }
}

/** Check out an existing ref (optionally forcing, discarding local changes). */
export async function checkout(
  cwd: string,
  ref: string,
  opts: { force?: boolean } = {},
): Promise<void> {
  const args = opts.force ? ["checkout", "-f", ref] : ["checkout", ref];
  try {
    await pexec("git", args, { cwd });
  } catch (err) {
    throw gitError(`checkout ${ref}`, err);
  }
}

/** Hard-reset the working tree and index to a ref (abort-cleanup only). */
export async function resetHard(cwd: string, ref: string): Promise<void> {
  try {
    await pexec("git", ["reset", "--hard", ref], { cwd });
  } catch (err) {
    throw gitError(`reset --hard ${ref}`, err);
  }
}

/** Force-delete a local branch (abort-cleanup only). */
export async function deleteBranch(cwd: string, name: string): Promise<void> {
  try {
    await pexec("git", ["branch", "-D", name], { cwd });
  } catch (err) {
    throw gitError(`branch -D ${name}`, err);
  }
}
