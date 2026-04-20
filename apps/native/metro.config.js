// Learn more: https://docs.expo.dev/guides/monorepos/
const path = require('path');
const { getDefaultConfig } = require('expo/metro-config');

const projectRoot = __dirname;
const workspaceRoot = path.resolve(projectRoot, '../..');

const config = getDefaultConfig(projectRoot);

// Watch workspace root in addition to Expo's defaults so Metro picks up
// @qook/shared changes without a full rebuild.
config.watchFolders = [...(config.watchFolders ?? []), workspaceRoot];

// Resolve modules from both project and workspace root node_modules so bun's
// hoisted workspace deps remain discoverable.
config.resolver.nodeModulesPaths = [
  path.resolve(projectRoot, 'node_modules'),
  path.resolve(workspaceRoot, 'node_modules'),
];

module.exports = config;
