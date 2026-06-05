import path from "node:path";
import { materialize } from "../lib/cow.js";
import { workspacePath, storeExists, isInside } from "../lib/store.js";

/**
 * Copy-on-write a single file inside a workspace. `filePath` may be relative to
 * the workspace root or an absolute path inside it.
 */
export async function materializeCommand(workspace: string, filePath: string): Promise<void> {
  const targetRoot = process.cwd();
  if (!(await storeExists(targetRoot))) {
    console.error("No .feverdreams store here. Run `feverdreams init` first.");
    process.exitCode = 1;
    return;
  }

  const wsRoot = workspacePath(targetRoot, workspace);
  const abs = path.isAbsolute(filePath) ? path.resolve(filePath) : path.resolve(wsRoot, filePath);

  if (!isInside(wsRoot, abs)) {
    console.error(`Refusing: ${abs} is outside workspace ${wsRoot}.`);
    process.exitCode = 1;
    return;
  }

  const res = await materialize(abs);
  const rel = path.relative(wsRoot, abs) || abs;
  console.log(`${res.status}: ${rel}`);
  if (res.status === "missing") process.exitCode = 1;
}
