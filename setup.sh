#!/usr/bin/env bash
# First-time setup wizard (macOS / Linux). Only checks that Node.js exists, then runs setup.mjs.
# Nothing is downloaded or installed unless you choose it inside the wizard.   Run:  bash setup.sh
if ! command -v node >/dev/null 2>&1; then
  echo "Node.js 20 or newer is needed and was not found."
  echo "  Install it from https://nodejs.org (or with your package manager, nvm, fnm, brew install node)."
  echo "Then run: bash setup.sh   Nothing was changed."
  exit 1
fi
exec node "$(cd "$(dirname "$0")" && pwd)/setup.mjs" "$@"
