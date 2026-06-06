import { collectChanges } from "../core/diff.js";

export async function diffCommand(workspace: string): Promise<void> {
  const targetRoot = process.cwd();
  try {
    const changes = await collectChanges(targetRoot, workspace);
    if (changes.length === 0) {
      console.log(`Workspace "${workspace}" has no changes against the base.`);
      return;
    }

    for (const c of changes) {
      const marker = c.action === "added" ? "A" : "M";
      console.log(`${marker} ${c.rel}`);
    }
    const added = changes.filter((c) => c.action === "added").length;
    const modified = changes.length - added;
    console.log(`\n${changes.length} change(s): ${modified} modified, ${added} added.`);
  } catch (err) {
    console.error(err instanceof Error ? err.message : String(err));
    process.exitCode = 1;
  }
}
