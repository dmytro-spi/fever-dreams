import { execFile } from "node:child_process";
import { promisify } from "node:util";

const pexec = promisify(execFile);

export async function isGitRepo(cwd: string): Promise<boolean> {
  try {
    const { stdout } = await pexec("git", ["rev-parse", "--is-inside-work-tree"], { cwd });
    return stdout.trim() === "true";
  } catch {
    return false;
  }
}

export async function currentBranch(cwd: string): Promise<string | null> {
  try {
    const { stdout } = await pexec("git", ["rev-parse", "--abbrev-ref", "HEAD"], { cwd });
    const branch = stdout.trim();
    return branch === "HEAD" ? null : branch;
  } catch {
    return null;
  }
}

export async function listBranches(cwd: string): Promise<string[]> {
  try {
    const { stdout } = await pexec("git", ["branch", "--format=%(refname:short)"], { cwd });
    return stdout
      .split("\n")
      .map((s) => s.trim())
      .filter(Boolean);
  } catch {
    return [];
  }
}

export async function branchCommit(cwd: string, branch: string): Promise<string | null> {
  try {
    const { stdout } = await pexec("git", ["rev-parse", branch], { cwd });
    return stdout.trim();
  } catch {
    return null;
  }
}
