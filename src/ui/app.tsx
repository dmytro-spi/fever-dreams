import { Box, Text, useApp, useInput } from "ink";
import { useEffect, useState } from "react";
import path from "node:path";
import {
  storeExists,
  readConfig,
  workspacePath,
  isInside,
  type Config,
} from "../lib/store.js";
import { isGitRepo, listBranches } from "../lib/git.js";
import { initStore } from "../core/init.js";
import {
  listWorkspaces,
  createWorkspace,
  removeWorkspace,
  agentInstruction,
  type WorkspaceInfo,
} from "../core/workspaces.js";
import { materialize } from "../lib/cow.js";
import { currentApplyLock, applyToBase, revertFromBase } from "../core/apply.js";
import { createBranchFromWorkspace } from "../core/branch.js";
import { collectChanges } from "../core/diff.js";
import { Header } from "./components/Header.js";
import { Footer } from "./components/Footer.js";
import { WorkspaceList } from "./components/WorkspaceList.js";
import { BranchSelect } from "./components/BranchSelect.js";
import { TextPrompt } from "./components/TextPrompt.js";

type View =
  | "loading"
  | "no-store"
  | "branch-select"
  | "list"
  | "detail"
  | "create"
  | "confirm-delete"
  | "materialize"
  | "branch-name"
  | "branch-message";

function errMsg(e: unknown): string {
  return e instanceof Error ? e.message : String(e);
}

const HINTS: Record<View, string> = {
  loading: "loading…",
  "no-store": "i init   q quit",
  "branch-select": "↑↓ move   ↵ select   esc cancel",
  list: "↑↓ move  ↵ open  n new  m materialize  a apply  b branch  v revert  d delete  q quit",
  detail: "esc back   q quit",
  create: "enter confirm   esc cancel",
  "confirm-delete": "y confirm   n cancel",
  materialize: "enter confirm   esc cancel",
  "branch-name": "enter next   esc cancel",
  "branch-message": "enter create   esc cancel",
};

export function App() {
  const { exit } = useApp();
  const targetRoot = process.cwd();

  const [view, setView] = useState<View>("loading");
  const [config, setConfig] = useState<Config | null>(null);
  const [workspaces, setWorkspaces] = useState<WorkspaceInfo[]>([]);
  const [selected, setSelected] = useState(0);
  const [branches, setBranches] = useState<string[]>([]);
  const [branchSel, setBranchSel] = useState(0);
  const [notice, setNotice] = useState<string | null>(null);
  const [applied, setApplied] = useState<string | null>(null);
  const [detailSummary, setDetailSummary] = useState<string | null>(null);
  const [branchName, setBranchName] = useState("");

  async function reload(): Promise<void> {
    if (await storeExists(targetRoot)) {
      const cfg = await readConfig(targetRoot);
      const ws = await listWorkspaces(targetRoot);
      const lock = await currentApplyLock(targetRoot);
      setConfig(cfg);
      setWorkspaces(ws);
      setApplied(lock?.workspace ?? null);
      setSelected((s) => Math.min(s, Math.max(0, ws.length - 1)));
      setView("list");
    } else {
      setView("no-store");
    }
  }

  useEffect(() => {
    void reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function startInit(): Promise<void> {
    try {
      if (await isGitRepo(targetRoot)) {
        const br = await listBranches(targetRoot);
        if (br.length > 0) {
          setBranches(br);
          setBranchSel(0);
          setView("branch-select");
          return;
        }
      }
      await initStore(targetRoot, {});
      setNotice("Initialized .feverdreams store.");
      await reload();
    } catch (e) {
      setNotice(errMsg(e));
    }
  }

  async function confirmBranch(branch: string): Promise<void> {
    try {
      await initStore(targetRoot, { branch });
      setNotice(`Initialized on base ${branch}.`);
      await reload();
    } catch (e) {
      setNotice(errMsg(e));
      setView("no-store");
    }
  }

  async function doCreate(name: string): Promise<void> {
    const trimmed = name.trim();
    if (!trimmed) {
      setView("list");
      return;
    }
    try {
      const { stats } = await createWorkspace(targetRoot, trimmed);
      setNotice(`Created "${trimmed}" — ${stats.links} files linked.`);
      await reload();
    } catch (e) {
      setNotice(errMsg(e));
      setView("list");
    }
  }

  async function doDelete(): Promise<void> {
    const ws = workspaces[selected];
    if (!ws) {
      setView("list");
      return;
    }
    try {
      await removeWorkspace(targetRoot, ws.name);
      setNotice(`Removed "${ws.name}".`);
      await reload();
    } catch (e) {
      setNotice(errMsg(e));
      setView("list");
    }
  }

  async function doMaterialize(rel: string): Promise<void> {
    const ws = workspaces[selected];
    const trimmed = rel.trim();
    if (!ws || !trimmed) {
      setView("list");
      return;
    }
    try {
      const wsRoot = workspacePath(targetRoot, ws.name);
      const abs = path.resolve(wsRoot, trimmed);
      if (!isInside(wsRoot, abs)) throw new Error("Path is outside the workspace.");
      const res = await materialize(abs);
      setNotice(`materialize ${res.status}: ${trimmed}`);
    } catch (e) {
      setNotice(errMsg(e));
    }
    setView("list");
  }

  async function doApply(): Promise<void> {
    const ws = workspaces[selected];
    if (!ws) return;
    try {
      const manifest = await applyToBase(targetRoot, ws.name);
      setNotice(`Applied "${ws.name}" — ${manifest.files.length} file(s) on base. Press v to revert.`);
      await reload();
    } catch (e) {
      setNotice(errMsg(e));
    }
  }

  function startBranchMessage(name: string): void {
    const trimmed = name.trim();
    if (!trimmed) {
      setView("list");
      return;
    }
    setBranchName(trimmed);
    setView("branch-message");
  }

  async function doBranch(message: string): Promise<void> {
    const ws = workspaces[selected];
    const trimmed = message.trim();
    if (!ws || !trimmed) {
      setView("list");
      return;
    }
    setView("list");
    try {
      const r = await createBranchFromWorkspace(targetRoot, ws.name, branchName, trimmed);
      setNotice(
        `Created branch "${r.branch}" from "${r.baseBranch}" — ${r.files} file(s). Base restored.`,
      );
      await reload();
    } catch (e) {
      setNotice(errMsg(e));
    }
  }

  async function doRevert(): Promise<void> {
    try {
      const manifest = await revertFromBase(targetRoot, {});
      setNotice(`Reverted "${manifest.workspace}". Base is pristine.`);
      await reload();
    } catch (e) {
      setNotice(errMsg(e));
    }
  }

  async function openDetail(): Promise<void> {
    const ws = workspaces[selected];
    if (!ws) return;
    setDetailSummary(null);
    setView("detail");
    try {
      const changes = await collectChanges(targetRoot, ws.name);
      if (changes.length === 0) {
        setDetailSummary("No changes against the base.");
      } else {
        const added = changes.filter((c) => c.action === "added").length;
        const modified = changes.length - added;
        const preview = changes
          .slice(0, 8)
          .map((c) => `  ${c.action === "added" ? "A" : "M"} ${c.rel}`)
          .join("\n");
        const more = changes.length > 8 ? `\n  … ${changes.length - 8} more` : "";
        setDetailSummary(`${modified} modified, ${added} added:\n${preview}${more}`);
      }
    } catch (e) {
      setDetailSummary(errMsg(e));
    }
  }

  useInput((input, key) => {
    // Text-entry views own their input (handled by TextPrompt).
    if (["create", "materialize", "branch-name", "branch-message"].includes(view)) return;

    if (key.ctrl && input === "c") {
      exit();
      return;
    }

    if (view === "no-store") {
      if (input === "i") void startInit();
      else if (input === "q") exit();
      return;
    }

    if (view === "branch-select") {
      if (key.upArrow) setBranchSel((i) => Math.max(0, i - 1));
      else if (key.downArrow) setBranchSel((i) => Math.min(branches.length - 1, i + 1));
      else if (key.return) void confirmBranch(branches[branchSel]);
      else if (key.escape) setView("no-store");
      return;
    }

    if (view === "detail") {
      if (key.escape || input === "b") setView("list");
      else if (input === "q") exit();
      return;
    }

    if (view === "confirm-delete") {
      if (input === "y") void doDelete();
      else if (input === "n" || key.escape) setView("list");
      return;
    }

    // list (default)
    if (key.upArrow) setSelected((i) => Math.max(0, i - 1));
    else if (key.downArrow)
      setSelected((i) => Math.min(Math.max(0, workspaces.length - 1), i + 1));
    else if (input === "n") {
      setNotice(null);
      setView("create");
    } else if (input === "d") {
      if (workspaces[selected]) setView("confirm-delete");
    } else if (input === "m") {
      if (workspaces[selected]) {
        setNotice(null);
        setView("materialize");
      }
    } else if (input === "a") {
      setNotice(null);
      void doApply();
    } else if (input === "b") {
      if (workspaces[selected]) {
        setNotice(null);
        setBranchName("");
        setView("branch-name");
      }
    } else if (input === "v") {
      setNotice(null);
      void doRevert();
    } else if (key.return) {
      if (workspaces[selected]) void openDetail();
    } else if (input === "r") void reload();
    else if (input === "q") exit();
  });

  const selectedWs = workspaces[selected];

  return (
    <Box flexDirection="column">
      <Header config={config} appliedWorkspace={applied} />

      {view === "loading" && (
        <Box paddingX={1}>
          <Text dimColor>Loading…</Text>
        </Box>
      )}

      {view === "no-store" && (
        <Box flexDirection="column" paddingX={1}>
          <Text>No FeverDreams store in this folder.</Text>
          <Text dimColor>Press i to initialize it here ({targetRoot}).</Text>
        </Box>
      )}

      {view === "branch-select" && <BranchSelect branches={branches} selected={branchSel} />}

      {(view === "list" || view === "detail" || view === "confirm-delete") && (
        <WorkspaceList items={workspaces} selected={selected} appliedWorkspace={applied} />
      )}

      {view === "detail" && selectedWs && (
        <Box flexDirection="column" paddingX={1} marginTop={1}>
          <Text bold>{selectedWs.name}</Text>
          <Text dimColor>path: {workspacePath(targetRoot, selectedWs.name)}</Text>
          <Text> </Text>
          <Text>Changes vs base:</Text>
          <Text color="cyan">{detailSummary ?? "computing…"}</Text>
          <Text> </Text>
          <Text>Agent instruction:</Text>
          <Text color="green">{agentInstruction(workspacePath(targetRoot, selectedWs.name))}</Text>
        </Box>
      )}

      {view === "confirm-delete" && selectedWs && (
        <Box paddingX={1} marginTop={1}>
          <Text color="red">
            Remove "{selectedWs.name}"? Originals are untouched. (y/n)
          </Text>
        </Box>
      )}

      {view === "create" && (
        <TextPrompt
          label="New workspace name:"
          placeholder="my-feature"
          onSubmit={(v) => void doCreate(v)}
          onCancel={() => setView("list")}
        />
      )}

      {view === "materialize" && selectedWs && (
        <TextPrompt
          label={`Materialize file in "${selectedWs.name}" (path relative to workspace):`}
          placeholder="src/app.ts"
          onSubmit={(v) => void doMaterialize(v)}
          onCancel={() => setView("list")}
        />
      )}

      {view === "branch-name" && selectedWs && (
        <TextPrompt
          label={`New git branch from "${selectedWs.name}":`}
          placeholder="my-feature"
          onSubmit={(v) => startBranchMessage(v)}
          onCancel={() => setView("list")}
        />
      )}

      {view === "branch-message" && selectedWs && (
        <TextPrompt
          label={`Commit message for "${branchName}":`}
          placeholder="add my feature"
          onSubmit={(v) => void doBranch(v)}
          onCancel={() => setView("list")}
        />
      )}

      {notice && (
        <Box paddingX={1} marginTop={1}>
          <Text color="yellow">{notice}</Text>
        </Box>
      )}

      <Box marginTop={1}>
        <Footer hints={HINTS[view]} />
      </Box>
    </Box>
  );
}
