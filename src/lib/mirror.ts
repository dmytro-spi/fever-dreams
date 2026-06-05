import { promises as fs } from "node:fs";
import path from "node:path";
import type { Matcher } from "./ignore.js";

export interface MirrorStats {
  dirs: number;
  links: number;
  skipped: number;
}

/**
 * Mirror `sourceRoot` into `destRoot`:
 *  - directories become REAL directories (so per-file copy-on-write works and
 *    new files land in the workspace, not the original);
 *  - files become symlinks pointing at the ABSOLUTE original path;
 *  - ignored paths are skipped (and ignored dirs are not descended into).
 */
export async function mirror(
  sourceRoot: string,
  destRoot: string,
  matcher: Matcher,
): Promise<MirrorStats> {
  const stats: MirrorStats = { dirs: 0, links: 0, skipped: 0 };
  await fs.mkdir(destRoot, { recursive: true });

  async function walk(relDir: string): Promise<void> {
    const absSrcDir = path.join(sourceRoot, relDir);
    const entries = await fs.readdir(absSrcDir, { withFileTypes: true });

    for (const entry of entries) {
      const relPath = relDir ? path.join(relDir, entry.name) : entry.name;
      const isDir = entry.isDirectory();

      if (matcher.ignores(relPath, isDir)) {
        stats.skipped++;
        continue;
      }

      const absDest = path.join(destRoot, relPath);

      if (isDir) {
        await fs.mkdir(absDest, { recursive: true });
        stats.dirs++;
        await walk(relPath);
      } else if (entry.isFile() || entry.isSymbolicLink()) {
        const absSrc = path.join(sourceRoot, relPath);
        await fs.symlink(absSrc, absDest);
        stats.links++;
      } else {
        // sockets, fifos, block devices — skip
        stats.skipped++;
      }
    }
  }

  await walk("");
  return stats;
}
