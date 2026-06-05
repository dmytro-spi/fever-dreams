import { Box, Text } from "ink";

export function BranchSelect({
  branches,
  selected,
}: {
  branches: string[];
  selected: number;
}) {
  return (
    <Box flexDirection="column" paddingX={1}>
      <Text bold>Select base git branch</Text>
      {branches.map((b, i) => (
        <Text key={b} color={i === selected ? "cyan" : undefined}>
          {i === selected ? "❯ " : "  "}
          {b}
        </Text>
      ))}
    </Box>
  );
}
