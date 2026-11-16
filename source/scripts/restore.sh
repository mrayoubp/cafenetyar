#!/usr/bin/env bash
# Restore a Convex export into an explicitly named deployment.
# Production restore requires ALLOW_PRODUCTION_RESTORE=YES and human approval.
set -Eeuo pipefail
umask 077

usage() {
  cat <<'EOF'
Usage:
  scripts/restore.sh <backup.zip> <deployment-name> --confirm

Examples:
  scripts/restore.sh backups/prod-20261109-120000.zip team/project:staging --confirm

Safety:
  - The archive is integrity-checked before import.
  - --replace-all replaces every table in the target deployment.
  - A deployment containing "prod" is refused unless
    ALLOW_PRODUCTION_RESTORE=YES is explicitly set by an operator.
EOF
}

[[ $# -eq 3 ]] || {
  usage
  exit 1
}

ARCHIVE="$1"
TARGET_DEPLOYMENT="$2"
CONFIRMATION="$3"
[[ "$CONFIRMATION" == "--confirm" ]] || {
  usage
  exit 1
}
[[ -f "$ARCHIVE" ]] || {
  echo "Archive not found: $ARCHIVE" >&2
  exit 1
}
[[ -n "$TARGET_DEPLOYMENT" ]] || {
  echo "Target deployment is required." >&2
  exit 1
}

if [[ "$TARGET_DEPLOYMENT" == *prod* && "${ALLOW_PRODUCTION_RESTORE:-}" != "YES" ]]; then
  echo "Refusing production restore without ALLOW_PRODUCTION_RESTORE=YES." >&2
  echo "Restore into staging first and verify the application." >&2
  exit 1
fi

command -v bunx >/dev/null 2>&1 || {
  echo "bunx is required." >&2
  exit 1
}
command -v unzip >/dev/null 2>&1 || {
  echo "unzip is required." >&2
  exit 1
}

echo "Checking archive integrity..."
unzip -tqq "$ARCHIVE" >/dev/null

echo "WARNING: importing into '$TARGET_DEPLOYMENT' with --replace-all."
echo "This replaces existing documents in the target deployment."
bunx convex import \
  --deployment "$TARGET_DEPLOYMENT" \
  --replace-all \
  -y \
  "$ARCHIVE"

echo "Restore finished. Run smoke checks and verify authentication, billing and tenant isolation."
