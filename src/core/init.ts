import { isGitRepo, currentBranch, branchCommit } from "../lib/git.js";
import { storeExists, writeConfig, type Config } from "../lib/store.js";

export interface InitStoreOptions {
  /** Base git branch to record. If omitted, falls back to the current branch. */
  branch?: string | null;
  /** Reinitialize even if a store already exists. */
  force?: boolean;
}

/**
 * Initialize the .feverdreams store for `targetRoot` and return the written config.
 * Branch *selection* (interactive listing) is the caller's job; this just records
 * the chosen branch (or the current one) and its tip commit.
 *
 * Throws if a store already exists and `force` is not set.
 */
export async function initStore(targetRoot: string, opts: InitStoreOptions = {}): Promise<Config> {
  if ((await storeExists(targetRoot)) && !opts.force) {
    throw new Error(
      `.feverdreams is already initialized in ${targetRoot}. Use force to reinitialize.`,
    );
  }

  let baseBranch: string | null = null;
  let baseCommit: string | null = null;

  if (await isGitRepo(targetRoot)) {
    baseBranch = opts.branch ?? (await currentBranch(targetRoot));
    if (baseBranch) baseCommit = await branchCommit(targetRoot, baseBranch);
  }

  const config: Config = {
    version: 1,
    targetRoot,
    baseBranch,
    baseCommit,
    createdAt: new Date().toISOString(),
  };

  await writeConfig(targetRoot, config);
  return config;
}
