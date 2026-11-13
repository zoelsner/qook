#!/bin/sh
# Publish the JS on origin/main to installed production builds (EAS Update).
# Usage: sh scripts/release/publish-update.sh "what changed"
#
# An update only reaches builds with the same runtime version (a fingerprint
# of the native code and app config). This refuses to publish anything that
# is not exactly origin/main, or that the latest production build cannot run.
set -eu
message=${1:?usage: publish-update.sh \"what changed\"}
cd "$(dirname "$0")/../.."

git fetch -q origin
[ -z "$(git status --porcelain)" ] || { echo "Working tree is not clean." >&2; exit 1; }
[ "$(git rev-parse HEAD)" = "$(git rev-parse origin/main)" ] || { echo "HEAD is not origin/main." >&2; exit 1; }
bun install --frozen-lockfile

cd apps/native
json() { node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>console.log(eval("JSON.parse(s)"+process.argv[1])??""))' "$1"; }
want=$(npx expo-updates runtimeversion:resolve --platform ios | json '.runtimeVersion')
have=$(npx eas-cli@latest build:list --platform ios --build-profile production --status finished --limit 1 --json --non-interactive | json '[0]?.runtime?.version')
[ -n "$want" ] && [ "$want" = "$have" ] || {
  echo "Not published: this code's runtime ($want) is not the latest production build's ($have). It needs a new build." >&2
  exit 1
}

npx eas-cli@latest update --channel production --platform ios --message "$message" --non-interactive
