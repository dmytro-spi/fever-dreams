import { applyToBase, revertFromBase, applyTest, currentApplySession, currentApplyLock } from "../core/apply.js";

function fail(err: unknown): void {
  console.error(err instanceof Error ? err.message : String(err));
  process.exitCode = 1;
}

export async function applyCommand(workspace: string, opts: { run?: string }): Promise<void> {
  const targetRoot = process.cwd();

  try {
    if (opts.run) {
      console.log(`Applying "${workspace}" and running: ${opts.run}`);
      const { exitCode } = await applyTest(targetRoot, workspace, opts.run);
      console.log(`Reverted. Command exited with code ${exitCode}.`);
      process.exitCode = exitCode;
      return;
    }

    const manifest = await applyToBase(targetRoot, workspace);
    console.log(`✅ Applied ${manifest.files.length} file(s) from "${workspace}" to the base.`);
    console.log("   Run your tests, then restore the base with: feverdreams revert");
  } catch (err) {
    fail(err);
  }
}

export async function revertCommand(
  workspace: string | undefined,
  opts: { force?: boolean } = {},
): Promise<void> {
  const targetRoot = process.cwd();
  try {
    const manifest = await revertFromBase(targetRoot, {
      expectWorkspace: workspace,
      force: opts.force,
    });
    console.log(`✅ Reverted "${manifest.workspace}". The base is pristine again.`);
  } catch (err) {
    fail(err);
  }
}

export async function statusCommand(): Promise<void> {
  const targetRoot = process.cwd();
  const lock = await currentApplyLock(targetRoot);
  if (!lock) {
    console.log("🔓 Base is free — nothing applied.");
    return;
  }

  const manifest = await currentApplySession(targetRoot);
  const session = lock.holder.session ? `, session ${lock.holder.session}` : "";

  console.log(`🔒 Base holds "${lock.workspace}".`);
  console.log(`   operation: ${lock.operation}`);
  console.log(`   holder:    ${lock.holder.pid}@${lock.holder.host}${session}`);
  console.log(`   since:     ${lock.acquiredAt}`);

  if (manifest) {
    console.log(`   files:     ${manifest.files.length} applied to base`);
    console.log("   Restore with: feverdreams revert");
  } else {
    // Lock without a manifest = an apply was interrupted before touching the base.
    console.log("   ⚠️  no manifest — an apply was interrupted before changing the base.");
    console.log("   The base is untouched; clear the stuck lock with: feverdreams revert --force");
  }
}
