#!/usr/bin/env bash
# Runs every audit instrument in order and fails if any of them fails.
#
#   bash scripts/audit/run.sh                 # all instruments
#   bash scripts/audit/run.sh styles          # one instrument
#   bash scripts/audit/run.sh browser --only=icons
#
# Needs the app on :3000 and the API on :8080 (see docs/AUDITS.md).
set -uo pipefail
cd "$(dirname "$0")/../.." || exit 2
# shellcheck source=scripts/audit/env.sh
. scripts/audit/env.sh

if [ "${1:-}" = "styles" ]; then
  shift
  exec node scripts/audit/styles.cjs "$@"
fi
if [ "${1:-}" = "browser" ]; then
  shift
  exec node scripts/audit/browser.cjs "$@"
fi
exec node scripts/audit/run.cjs "$@"
