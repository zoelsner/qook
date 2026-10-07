#!/bin/sh
set -eu
cd "$(dirname "$0")/../.."
python3 - "${1:-test}" <<'PY'
from pathlib import Path
import subprocess
import sys

legacy = Path('supabase/functions/generate-recipe/persist.test.ts')
tests = sorted(str(p) for p in Path('supabase/functions').rglob('*.test.ts') if p != legacy)
entries = sorted(str(p) for p in Path('supabase/functions').glob('*/index.ts'))
common = ['--no-config', '--frozen', '--lock=supabase/functions/deno.lock', '--node-modules-dir=none']
mode = sys.argv[1]
if mode == 'cache':
    command = ['deno', 'cache', *common, 'scripts/qa/persist.test.ts', *tests, *entries]
elif mode == 'check':
    command = ['deno', 'test', *common, '--no-run', '--cached-only', '--deny-net', *entries]
elif mode == 'test':
    command = ['deno', 'test', *common, '--cached-only', '--allow-env', '--allow-read', '--deny-net', 'scripts/qa/persist.test.ts', *tests]
else:
    raise SystemExit('Usage: scripts/qa/run-backend-tests.sh [cache|check|test]')
raise SystemExit(subprocess.call(command))
PY
