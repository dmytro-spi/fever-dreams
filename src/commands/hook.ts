import path from "node:path";
import { materialize } from "../lib/cow.js";
import { findStoreRoot, workspacesPath, isInside } from "../lib/store.js";

interface PreToolUsePayload {
  tool_input?: {
    file_path?: string;
  };
}

/**
 * Claude Code PreToolUse hook. Reads the tool payload on stdin and, if the
 * target file is a symlink inside a `.feverdreams/workspaces/` tree, materializes
 * it (copy-on-write) BEFORE the edit happens.
 *
 * This hook must never block the agent: any error or non-match exits 0.
 */
export async function hookRun(): Promise<void> {
  try {
    const input = await readStdin();
    if (!input.trim()) return;

    const payload = JSON.parse(input) as PreToolUsePayload;
    const filePath = payload.tool_input?.file_path;
    if (!filePath) return;

    const abs = path.resolve(filePath);

    // Locate the store at/above the file, then confirm the file lives inside
    // that store's workspaces/ tree before touching anything.
    const storeRoot = await findStoreRoot(path.dirname(abs));
    if (!storeRoot) return;
    if (!isInside(workspacesPath(storeRoot), abs)) return;

    await materialize(abs);
  } catch {
    // swallow — never block the tool
  } finally {
    process.exitCode = 0;
  }
}

function readStdin(): Promise<string> {
  return new Promise((resolve) => {
    if (process.stdin.isTTY) {
      resolve("");
      return;
    }
    let data = "";
    process.stdin.setEncoding("utf8");
    process.stdin.on("data", (chunk) => (data += chunk));
    process.stdin.on("end", () => resolve(data));
    process.stdin.on("error", () => resolve(data));
  });
}
