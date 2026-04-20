// Learn more: https://docs.expo.dev/guides/monorepos/
const path = require('path');
const { getDefaultConfig } = require('expo/metro-config');

const projectRoot = __dirname;
const workspaceRoot = path.resolve(projectRoot, '../..');

const config = getDefaultConfig(projectRoot);

// #1 — Watch all files in the monorepo so Metro picks up workspace deps.
config.watchFolders = [workspaceRoot];

// #2 — Resolve modules from both project and workspace root node_modules.
config.resolver.nodeModulesPaths = [
  path.resolve(projectRoot, 'node_modules'),
  path.resolve(workspaceRoot, 'node_modules'),
];

// #3 — Explicit workspace alias (bun's workspace link creates a symlink,
// but an alias keeps resolution deterministic across platforms).
config.resolver.extraNodeModules = {
  ...(config.resolver.extraNodeModules ?? {}),
  '@qook/shared': path.resolve(workspaceRoot, 'packages/shared/src'),
};

// #4 — Disable hierarchical lookup so Metro doesn't walk out of the monorepo.
config.resolver.disableHierarchicalLookup = true;

module.exports = config;
