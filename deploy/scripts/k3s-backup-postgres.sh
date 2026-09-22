#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck disable=SC1091
source "${SCRIPT_DIR}/common.sh"

require_env_file

BACKUP_DIR="${BACKUP_DIR:-${ROOT_DIR}/deploy/backups/postgres}"
NAMESPACE="${K8S_NAMESPACE:-phyok}"
POD_NAME="${POSTGRES_POD_NAME:-postgres-0}"
RETENTION_DAYS="${RETENTION_DAYS:-7}"

load_env_file_exports "${ENV_FILE}"

POSTGRES_DB="${POSTGRES_DB:-phyok}"
POSTGRES_USER="${POSTGRES_USER:-phyok}"
POSTGRES_PASSWORD="${POSTGRES_PASSWORD:-change_me_pg}"

mkdir -p "${BACKUP_DIR}"
TIMESTAMP="$(date +%Y%m%d_%H%M%S)"
BACKUP_FILE="${BACKUP_DIR}/phyok_pg_${TIMESTAMP}.sql.gz"

if ! command -v kubectl >/dev/null 2>&1; then
  echo "kubectl is required."
  exit 1
fi

kubectl exec -n "${NAMESPACE}" "${POD_NAME}" -- env PGPASSWORD="${POSTGRES_PASSWORD}" \
  pg_dump -U "${POSTGRES_USER}" -d "${POSTGRES_DB}" | gzip > "${BACKUP_FILE}"

find "${BACKUP_DIR}" -type f -name "*.sql.gz" -mtime +"${RETENTION_DAYS}" -delete

echo "PostgreSQL backup created: ${BACKUP_FILE}"
