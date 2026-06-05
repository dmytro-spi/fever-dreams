import { Box, Text } from "ink";

export function Footer({ hints }: { hints: string }) {
  return (
    <Box paddingX={1}>
      <Text dimColor>{hints}</Text>
    </Box>
  );
}
