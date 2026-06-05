import { render } from "ink";
import { App } from "./app.js";

/** Launch the interactive full-screen UI. Requires an interactive TTY. */
export async function runUI(): Promise<void> {
  if (!process.stdin.isTTY) {
    console.error("Interactive UI needs a TTY. Use subcommands instead:");
    console.error("  feverdreams init");
    console.error("  feverdreams workspace create <name> | list | remove <name>");
    console.error("  feverdreams materialize <workspace> <path>");
    process.exitCode = 1;
    return;
  }

  const app = render(<App />);
  await app.waitUntilExit();
}
