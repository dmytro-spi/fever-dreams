import { promises as fs } from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";

// `ignore` is a CommonJS module whose default export does not stay callable
// under NodeNext interop, so load it via require.
const require = createRequire(import.meta.url);
interface IgnoreInstance {
  add(pattern: string | string[]): IgnoreInstance;
  ignores(pathname: string): boolean;
}
const ignore = require("ignore") as (options?: unknown) => IgnoreInstance;

/** Directory/file names skipped by default, regardless of .gitignore. */
export const DEFAULT_IGNORES = [
  "node_modules",
  ".git",
  ".feverdreams",
  "dist",
  "build",
  ".next",
  "out",
  "coverage",
  ".cache",
  ".turbo",
  ".venv",
  "__pycache__",
  "target",
  "vendor",
  ".DS_Store",
];

export interface Matcher {
  /** `relPath` is POSIX-style, relative to the project root, without a leading slash. */
  ignores(relPath: string, isDir: boolean): boolean;
}

export async function buildMatcher(targetRoot: string): Promise<Matcher> {
  const ig = ignore();
  // Bare names match at any depth (gitignore semantics).
  ig.add(DEFAULT_IGNORES);

  try {
    const gitignore = await fs.readFile(path.join(targetRoot, ".gitignore"), "utf8");
    ig.add(gitignore);
  } catch {
    // no .gitignore — fine
  }

  return {
    ignores(relPath: string, isDir: boolean): boolean {
      if (!relPath || relPath === ".") return false;
      // `ignore` expects POSIX separators and no leading slash.
      const posix = relPath.split(path.sep).join("/");
      const candidate = isDir ? `${posix}/` : posix;
      return ig.ignores(candidate);
    },
  };
}
