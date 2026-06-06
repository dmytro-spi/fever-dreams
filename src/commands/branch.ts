import { createBranchFromWorkspace } from "../core/branch.js";

function fail(err: unknown): void {
  console.error(err instanceof Error ? err.message : String(err));
  process.exitCode = 1;
}

export async function branchCommand(
  workspace: string,
  branchName: string,
  opts: { message: string; push?: boolean },
): Promise<void> {
  const targetRoot = process.cwd();

  try {
    const r = await createBranchFromWorkspace(targetRoot, workspace, branchName, opts.message, {
      push: opts.push,
    });

    console.log(`✅ Created branch "${r.branch}" from "${r.baseBranch}" with ${r.files} file(s).`);
    if (opts.push) {
      if (r.pushed) {
        console.log("   pushed to origin.");
      } else {
        console.log(`   ⚠️  push failed: ${r.pushError}`);
        console.log(`   push it manually: git push -u origin ${r.branch}`);
      }
    }
    console.log(`   base is back on "${r.baseBranch}", working tree pristine.`);
  } catch (err) {
    fail(err);
  }
}
