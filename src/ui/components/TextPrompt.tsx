import { Box, Text, useInput } from "ink";
import TextInput from "ink-text-input";
import { useState } from "react";

export function TextPrompt({
  label,
  placeholder,
  onSubmit,
  onCancel,
}: {
  label: string;
  placeholder?: string;
  onSubmit: (value: string) => void;
  onCancel: () => void;
}) {
  const [value, setValue] = useState("");

  useInput((_input, key) => {
    if (key.escape) onCancel();
  });

  return (
    <Box flexDirection="column" paddingX={1}>
      <Text>{label}</Text>
      <Box>
        <Text color="cyan">› </Text>
        <TextInput
          value={value}
          onChange={setValue}
          placeholder={placeholder}
          onSubmit={onSubmit}
        />
      </Box>
      <Text dimColor>enter to confirm · esc to cancel</Text>
    </Box>
  );
}
