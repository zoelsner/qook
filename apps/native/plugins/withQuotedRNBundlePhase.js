const { withXcodeProject } = require('expo/config-plugins');

// Our repo lives at a path containing a space ("Mobile Documents"), and the
// stock Expo/RN bare template's "Bundle React Native code and images" Xcode
// build phase resolves react-native-xcode.sh via an UNQUOTED backtick command
// substitution, which word-splits on that space and breaks the build.
// `expo prebuild` regenerates ios/ (gitignored CNG output) from that template
// every time, so the fix can't live as a committed patch — it has to be
// reapplied here. Remove this plugin once upstream Expo/RN quotes the
// substitution in the template.
const BROKEN_SUBSTITUTION =
  "`\\\"$NODE_BINARY\\\" --print \\\"require('path').dirname(require.resolve('react-native/package.json')) + '/scripts/react-native-xcode.sh'\\\"`";
const FIXED_SUBSTITUTION =
  "\\\"$(\\\"$NODE_BINARY\\\" --print \\\"require('path').dirname(require.resolve('react-native/package.json')) + '/scripts/react-native-xcode.sh'\\\")\\\"";

function withQuotedRNBundlePhase(config) {
  return withXcodeProject(config, (config) => {
    const phases = config.modResults.hash.project.objects.PBXShellScriptBuildPhase ?? {};
    for (const key of Object.keys(phases)) {
      const phase = phases[key];
      if (
        phase &&
        typeof phase === 'object' &&
        typeof phase.shellScript === 'string' &&
        phase.shellScript.includes(BROKEN_SUBSTITUTION)
      ) {
        phase.shellScript = phase.shellScript.split(BROKEN_SUBSTITUTION).join(FIXED_SUBSTITUTION);
      }
    }
    return config;
  });
}

module.exports = withQuotedRNBundlePhase;
