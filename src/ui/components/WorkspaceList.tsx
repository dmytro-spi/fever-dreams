import { Box, Text } from "ink";
import type { WorkspaceInfo } from "../../core/workspaces.js";

export function WorkspaceList({
  items,
  selected,
}: {
  items: WorkspaceInfo[];
  selected: number;
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
        return (
          <Text key={ws.name} color={active ? "cyan" : undefined}>
            {active ? "❯ " : "  "}
            {ws.name} <Text dimColor>{count} · base {base}</Text>
          </Text>
        );
      })}
    </Box>
  );
}
