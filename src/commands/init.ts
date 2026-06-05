import { select } from "@inquirer/prompts";
import { isGitRepo, currentBranch, listBranches, branchCommit } from "../lib/git.js";
import { storeExists, writeConfig, storePath, type Config } from "../lib/store.js";

export interface InitOptions {
  force?: boolean;
  branch?: string;
}

export async function initCommand(opts: InitOptions): Promise<void> {
  const targetRoot = process.cwd();

  if ((await storeExists(targetRoot)) && !opts.force) {
    console.error(
      `.feverdreams is already initialized in ${targetRoot}. Use --force to reinitialize.`,
    );
    process.exitCode = 1;
    return;
  }

  let baseBranch: string | null = null;
  let baseCommit: string | null = null;

  if (await isGitRepo(targetRoot)) {
    const current = await currentBranch(targetRoot);

    if (opts.branch) {
      baseBranch = opts.branch;
    } else {
      const branches = await listBranches(targetRoot);
      if (branches.length > 0) {
        baseBranch = await select({
          message: "Select base git branch:",
          default: current ?? branches[0],
          choices: branches.map((b) => ({
            name: b === current ? `${b} (current)` : b,
            value: b,
          })),
        });
      } else {
        baseBranch = current;
      }
    }

    if (baseBranch) baseCommit = await branchCommit(targetRoot, baseBranch);
    console.log(
      `Base branch: ${baseBranch ?? "(none)"}${baseCommit ? ` @ ${baseCommit.slice(0, 8)}` : ""}`,
    );
  } else {
    console.log("Not a git repository — proceeding without base branch selection.");
  }

  const config: Config = {
    version: 1,
    targetRoot,
    baseBranch,
    baseCommit,
    createdAt: new Date().toISOString(),
  };

  await writeConfig(targetRoot, config);
  console.log(`Initialized .feverdreams store at ${storePath(targetRoot)}`);
  console.log("Next: feverdreams workspace create <name>");
}
