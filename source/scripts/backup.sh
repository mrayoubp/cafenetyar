#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/../.."
node --env-file-if-exists=.env dist/linux/backup.mjs "$@"
