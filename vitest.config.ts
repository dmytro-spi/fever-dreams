import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    // Only our real tests — never the copies mirrored inside .feverdreams workspaces.
    include: ["test/**/*.test.ts"],
  },
});
