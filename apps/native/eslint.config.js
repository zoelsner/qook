const expoConfig = require('eslint-config-expo/flat');

module.exports = [
  ...expoConfig,
  {
    settings: {
      react: { version: '19.1.0' },
    },
  },
  {
    ignores: ['node_modules/**', 'dist/**', '.expo/**', 'babel.config.js'],
  },
];
