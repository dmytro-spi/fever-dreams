import { Box, Text } from "ink";
import type { WorkspaceInfo } from "../../core/workspaces.js";

export function WorkspaceList({
  items,
  selected,
  appliedWorkspace,
}: {
  items: WorkspaceInfo[];
  selected: number;
  appliedWorkspace: string | null;
}) {
  if (items.length === 0) {
    return (
      <Box paddingX={1}>
        <Text dimColor>No workspaces yet — press n to create one.</Text>
      </Box>
    );
  }

  return (
    <Box flexDirection="column" paddingX={1}>
      <Text bold>Workspaces ({items.length})</Text>
      {items.map((ws, i) => {
        const active = i === selected;
        const count = ws.fileCount == null ? "—" : `${ws.fileCount} files`;
        const base = ws.baseBranch ?? "no base";
        const applied = ws.name === appliedWorkspace;
        return (
          <Text key={ws.name} color={active ? "cyan" : undefined}>
            {active ? "❯ " : "  "}
            {ws.name} <Text dimColor>{count} · base {base}</Text>
            {applied ? <Text color="yellow"> ● applied</Text> : null}
          </Text>
        );
      })}
    </Box>
  );
}
