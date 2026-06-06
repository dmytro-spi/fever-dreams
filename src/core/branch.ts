import { storeExists } from "../lib/store.js";
import {
  isGitRepo,
  currentBranch,
  isClean,
  branchExists,
  hasRemote,
  createBranch,
  stageFiles,
  commit,
  pushBranch,
  checkout,
  resetHard,
  deleteBranch,
} from "../lib/git.js";
import { applyToBase, revertFromBase } from "./apply.js";

export interface BranchResult {
  /** The branch that was created. */
  branch: string;
  /** The branch we returned to afterward (the one HEAD was on at start). */
  baseBranch: string;
  /** Number of files committed onto the branch. */
  files: number;
  /** Whether the branch was pushed to the remote. */
  pushed: boolean;
  /** If a push was requested but failed, the error message (branch is kept). */
  pushError?: string;
}

function errMsg(e: unknown): string {
  return e instanceof Error ? e.message : String(e);
}

/**
 * Snapshot a workspace's changes into a new git branch.
 *
 * Under the apply lock: applies the workspace onto the base working tree, creates
 * `branchName` off the current HEAD, commits exactly the applied files, optionally
 * pushes, then returns the base repo to its original branch and pristine working
 * tree (releasing the lock). `applyToBase` makes file backups, so a failure before
 * the commit is fully recoverable.
 */
export async function createBranchFromWorkspace(
  targetRoot: string,
  workspace: string,
  branchName: string,
  message: string,
  opts: { push?: boolean } = {},
): Promise<BranchResult> {
  // --- Pre-flight: fail fast before mutating anything ----------------------
  if (!(await storeExists(targetRoot))) {
    throw new Error("No .feverdreams store here. Run `feverdreams init` first.");
  }
  if (!(await isGitRepo(targetRoot))) {
    throw new Error("The base project is not a git repository.");
  }
  const originalBranch = await currentBranch(targetRoot);
  if (!originalBranch) {
    throw new Error("Base repo is in detached HEAD — checkout a branch first.");
  }
  if (!(await isClean(targetRoot))) {
    throw new Error(
      "Base repo has uncommitted changes — commit or stash them before branching.",
    );
  }
  if (await branchExists(targetRoot, branchName)) {
    throw new Error(`Branch "${branchName}" already exists.`);
  }
  if (opts.push && !(await hasRemote(targetRoot, "origin"))) {
    throw new Error("No 'origin' remote configured — cannot --push.");
  }

  // --- Apply under the lock ------------------------------------------------
  const manifest = await applyToBase(targetRoot, workspace, "branch");
  const files = manifest.files.map((f) => f.rel);

  try {
    try {
      await createBranch(targetRoot, branchName);
      await stageFiles(targetRoot, files);
      await commit(targetRoot, message);
    } catch (err) {
      // Abort: get the repo back exactly to its starting state. The applied
      // files are still on disk; restore HEAD + index to originalBranch, drop the
      // orphan branch, then let `revertFromBase` (finally) clean the working tree.
      await checkout(targetRoot, originalBranch, { force: true }).catch(() => {});
      await resetHard(targetRoot, originalBranch).catch(() => {});
      await deleteBranch(targetRoot, branchName).catch(() => {});
      throw err;
    }

    // Commit succeeded → the working tree is clean relative to the new branch.
    // Optional push is best-effort: a push failure keeps the local branch.
    let pushed = false;
    let pushError: string | undefined;
    if (opts.push) {
      try {
        await pushBranch(targetRoot, branchName);
        pushed = true;
      } catch (err) {
        pushError = errMsg(err);
      }
    }

    // Back to the original branch (safe: tree is clean post-commit).
    await checkout(targetRoot, originalBranch);

    return { branch: branchName, baseBranch: originalBranch, files: files.length, pushed, pushError };
  } finally {
    // Always restore the base working tree and release the lock, whatever happened.
    await revertFromBase(targetRoot, { expectWorkspace: workspace, force: true });
  }
}
