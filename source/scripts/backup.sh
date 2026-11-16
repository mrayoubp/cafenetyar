#!/usr/bin/env bash
# Daily Convex backup with integrity checks and optional off-site copy.
# Required for production: CONVEX_DEPLOY_KEY (or a configured Convex CLI login).
# Optional: BACKUP_REMOTE=remote:kafinetyar/prod and a configured rclone remote.
set -Eeuo pipefail
umask 077

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
BACKUP_DIR="${BACKUP_DIR:-$ROOT_DIR/backups}"
RETENTION_DAYS="${RETENTION_DAYS:-30}"
STAMP="$(date -u +%Y%m%d-%H%M%S)"
ARCHIVE="$BACKUP_DIR/prod-$STAMP.zip"
CHECKSUM="$ARCHIVE.sha256"

log() {
  printf '[backup %s] %s\n' "$(date -u +%H:%M:%S)" "$*"
}

fail() {
  log "ERROR: $*" >&2
  exit 1
}

require_command() {
  command -v "$1" >/dev/null 2>&1 || fail "command '$1' is required"
}

require_command bunx
require_command unzip
require_command sha256sum
mkdir -p "$BACKUP_DIR"

if [[ -n "${BACKUP_DEPLOYMENT:-}" ]]; then
  DEPLOY_ARGS=(--deployment "$BACKUP_DEPLOYMENT")
  log "exporting deployment $BACKUP_DEPLOYMENT"
else
  DEPLOY_ARGS=(--prod)
  log "exporting production deployment"
fi

log "writing $ARCHIVE"
if ! bunx convex export "${DEPLOY_ARGS[@]}" \
  --include-file-storage \
  --path "$ARCHIVE"; then
  fail "Convex export failed; no successful backup is claimed"
fi

[[ -s "$ARCHIVE" ]] || fail "export produced an empty archive"
log "verifying zip integrity"
unzip -tqq "$ARCHIVE" >/dev/null || fail "zip integrity check failed"

(
  cd "$BACKUP_DIR"
  sha256sum "$(basename "$ARCHIVE")" >"$(basename "$CHECKSUM")"
)
log "checksum: $(cat "$CHECKSUM")"

if [[ -n "${BACKUP_REMOTE:-}" ]]; then
  require_command rclone
  log "copying archive off-server to $BACKUP_REMOTE"
  rclone copyto "$ARCHIVE" "${BACKUP_REMOTE%/}/$(basename "$ARCHIVE")"
  rclone copyto "$CHECKSUM" "${BACKUP_REMOTE%/}/$(basename "$CHECKSUM")"
  log "off-site copy completed"
else
  log "WARNING: BACKUP_REMOTE is not set; this copy is local only"
fi

log "applying local retention of $RETENTION_DAYS days"
find "$BACKUP_DIR" -maxdepth 1 -type f \
  \( -name 'prod-*.zip' -o -name 'prod-*.zip.sha256' \) \
  -mtime "+$RETENTION_DAYS" -print -delete

log "backup complete: $ARCHIVE"
