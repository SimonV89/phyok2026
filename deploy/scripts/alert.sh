#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck disable=SC1091
source "${SCRIPT_DIR}/common.sh"
GROUP="${1:-all}"
SUBJECT="${2:-}"
MESSAGE_FILE="${3:-}"

if ! group_exists "${GROUP}"; then
  echo "Usage: $0 {web|cms|node|java|all} [subject] [message-file]"
  exit 1
fi

if [[ -f "${ENV_FILE}" ]]; then
  load_env_file_exports "${ENV_FILE}"
fi

if [[ -z "${SUBJECT}" ]]; then
  echo "Alert target: ${ALERT_EMAIL_TO:-unset}"
  echo "Alert sender: ${ALERT_EMAIL_FROM:-unset}"
  echo "Target group: ${GROUP}"
  echo "Hook this script to cron or a process supervisor for crash and capacity notifications."
  exit 0
fi

HOSTNAME_VALUE="$(hostname 2>/dev/null || echo unknown-host)"
MESSAGE_HEADER="[$(date '+%Y-%m-%d %H:%M:%S')] group=${GROUP} host=${HOSTNAME_VALUE}"
MESSAGE_BODY="${MESSAGE_HEADER}"

if [[ -n "${MESSAGE_FILE}" && -f "${MESSAGE_FILE}" ]]; then
  MESSAGE_BODY="${MESSAGE_BODY}"$'\n\n'"$(cat "${MESSAGE_FILE}")"
fi

if [[ -z "${ALERT_EMAIL_TO:-}" ]]; then
  echo "ALERT_EMAIL_TO is not configured. Subject: ${SUBJECT}"
  echo "${MESSAGE_BODY}"
  exit 0
fi

if command -v mail >/dev/null 2>&1; then
  printf '%s\n' "${MESSAGE_BODY}" | mail -s "${SUBJECT}" "${ALERT_EMAIL_TO}"
  echo "Alert email sent to ${ALERT_EMAIL_TO}."
  exit 0
fi

if command -v sendmail >/dev/null 2>&1 && [[ -n "${ALERT_EMAIL_FROM:-}" ]]; then
  {
    printf 'Subject: %s\n' "${SUBJECT}"
    printf 'To: %s\n' "${ALERT_EMAIL_TO}"
    printf 'From: %s\n' "${ALERT_EMAIL_FROM}"
    printf 'Content-Type: text/plain; charset=UTF-8\n'
    printf '\n'
    printf '%s\n' "${MESSAGE_BODY}"
  } | sendmail -t
  echo "Alert email sent to ${ALERT_EMAIL_TO} via sendmail."
  exit 0
fi

echo "No local mail sender found. Subject: ${SUBJECT}"
echo "${MESSAGE_BODY}"
