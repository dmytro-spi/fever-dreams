import { select } from "@inquirer/prompts";
import { isGitRepo, currentBranch, listBranches } from "../lib/git.js";
import { storeExists, storePath } from "../lib/store.js";
import { initStore } from "../core/init.js";

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

  let branch: string | null = opts.branch ?? null;

  if (!branch && (await isGitRepo(targetRoot))) {
    const current = await currentBranch(targetRoot);
    const branches = await listBranches(targetRoot);
    if (branches.length > 0) {
      branch = await select({
        message: "Select base git branch:",
        default: current ?? branches[0],
        choices: branches.map((b) => ({
          name: b === current ? `${b} (current)` : b,
          value: b,
        })),
      });
    } else {
      branch = current;
    }
  }

  const config = await initStore(targetRoot, { branch, force: opts.force });

  if (config.baseBranch) {
    console.log(
      `Base branch: ${config.baseBranch}${config.baseCommit ? ` @ ${config.baseCommit.slice(0, 8)}` : ""}`,
    );
  } else {
    console.log("Not a git repository — proceeding without base branch selection.");
  }

  console.log(`Initialized .feverdreams store at ${storePath(targetRoot)}`);
  console.log("Next: feverdreams workspace create <name>");
}
