import { Box, Text } from "ink";
import type { Config } from "../../lib/store.js";

export function Header({ config }: { config: Config | null }) {
  const base = config?.baseBranch
    ? `${config.baseBranch}${config.baseCommit ? ` @ ${config.baseCommit.slice(0, 7)}` : ""}`
    : "(no git base)";

  return (
    <Box borderStyle="round" borderColor="magenta" paddingX={1} flexDirection="column">
      <Text bold color="magenta">
        FeverDreams
      </Text>
      <Text dimColor>
        store: {config ? ".feverdreams" : "(not initialized)"}   base: {base}
      </Text>
    </Box>
  );
}
