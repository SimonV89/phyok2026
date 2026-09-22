#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck disable=SC1091
source "${SCRIPT_DIR}/common.sh"

GROUP="${1:-all}"
BACKUP_CRON="${BACKUP_CRON:-0 3 * * *}"
HEALTHCHECK_CRON="${HEALTHCHECK_CRON:-*/10 * * * *}"
CRON_LOG_DIR="${K3S_CRON_LOG_DIR:-${ROOT_DIR}/deploy/backups/logs}"

if ! group_exists "${GROUP}"; then
  echo "Usage: $0 {web|cms|node|java|all}"
  exit 1
fi

mkdir -p "${CRON_LOG_DIR}"

backup_log="${CRON_LOG_DIR}/k3s-backup.log"
health_log="${CRON_LOG_DIR}/k3s-healthcheck.log"
backup_command="${SCRIPT_DIR}/k3s-backup-postgres.sh >> ${backup_log} 2>&1"
health_command="${SCRIPT_DIR}/k3s-healthcheck.sh ${GROUP} >> ${health_log} 2>&1"

current_crontab="$(mktemp)"
next_crontab="$(mktemp)"
cleanup() {
  rm -f "${current_crontab}" "${next_crontab}"
}
trap cleanup EXIT

crontab -l 2>/dev/null | grep -v 'phyok-k3s-backup' | grep -v 'phyok-k3s-healthcheck' > "${current_crontab}" || true
cp "${current_crontab}" "${next_crontab}"

{
  echo "${BACKUP_CRON} ${backup_command} # phyok-k3s-backup"
  echo "${HEALTHCHECK_CRON} ${health_command} # phyok-k3s-healthcheck"
} >> "${next_crontab}"

crontab "${next_crontab}"

echo "Installed k3s cron jobs for group '${GROUP}'."
echo "Backup cron: ${BACKUP_CRON}"
echo "Health cron: ${HEALTHCHECK_CRON}"
echo "Backup log: ${backup_log}"
echo "Health log: ${health_log}"
