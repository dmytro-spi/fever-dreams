#!/usr/bin/env node
// Sync the version from package.json (the single source of truth) into the static
// Claude Code plugin files, which external tooling reads and so can't import it.
// Run automatically by the npm `version` lifecycle hook; safe to run by hand.
import { readFileSync, writeFileSync } from "node:fs";

const root = new URL("../", import.meta.url);

function readJson(relative) {
  return JSON.parse(readFileSync(new URL(relative, root), "utf8"));
}

function writeJson(relative, obj) {
  // Match how these files are written elsewhere: 2-space indent + trailing newline.
  writeFileSync(new URL(relative, root), JSON.stringify(obj, null, 2) + "\n", "utf8");
}

const pkg = readJson("package.json");
const version = pkg.version;
const updated = [];

// plugin.json — top-level version.
const pluginPath = ".claude-plugin/plugin.json";
const plugin = readJson(pluginPath);
if (plugin.version !== version) {
  plugin.version = version;
  writeJson(pluginPath, plugin);
  updated.push(pluginPath);
}

// marketplace.json — version on the plugin entry matching this package's name.
const marketplacePath = ".claude-plugin/marketplace.json";
const marketplace = readJson(marketplacePath);
const entry =
  (marketplace.plugins ?? []).find((p) => p.name === pkg.name) ?? marketplace.plugins?.[0];
if (entry && entry.version !== version) {
  entry.version = version;
  writeJson(marketplacePath, marketplace);
  updated.push(marketplacePath);
}

if (updated.length === 0) {
  console.log(`sync-version: already at ${version} — nothing to update.`);
} else {
  console.log(`sync-version: set ${version} in ${updated.join(", ")}.`);
}
