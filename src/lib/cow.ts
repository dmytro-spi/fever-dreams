import { promises as fs } from "node:fs";

export type MaterializeStatus = "materialized" | "already-real" | "missing";

export interface MaterializeResult {
  status: MaterializeStatus;
  path: string;
}

/**
 * Copy-on-write primitive. If `absPath` is a symlink, replace it with a real
 * copy of the file it points to (preserving permissions). If it is already a
 * real file, do nothing. Idempotent.
 *
 * The replacement uses `rename` over the symlink, which is atomic and operates
 * on the link itself (rename does not follow symlinks), so the original target
 * is never touched.
 */
export async function materialize(absPath: string): Promise<MaterializeResult> {
  let stat;
  try {
    stat = await fs.lstat(absPath);
  } catch {
    return { status: "missing", path: absPath };
  }

  if (!stat.isSymbolicLink()) {
    return { status: "already-real", path: absPath };
  }

  const target = await fs.realpath(absPath);
  const targetStat = await fs.stat(target);
  const tmp = `${absPath}.feverdreams-cow-tmp`;

  await fs.copyFile(target, tmp);
  await fs.chmod(tmp, targetStat.mode & 0o777);
  await fs.rename(tmp, absPath); // atomically replaces the symlink

  return { status: "materialized", path: absPath };
}
