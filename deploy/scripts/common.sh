#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
ENV_FILE="${ROOT_DIR}/env2"
COMPOSE_FILE="${ROOT_DIR}/deploy/compose/docker-compose.prod.yml"

JAVA_INFRA_SERVICES=(postgres redis qdrant kafka)
JAVA_APP_SERVICES=(
  auth-service
  tenant-service
  memory-service
  knowledge-service
  billing-service
  payment-service
  audit-service
  privacy-service
  ops-admin-service
)
NODE_SERVICES=(node2-runtime)
WEB_SERVICES=(chat-web)
CMS_SERVICES=()
JAVA_K8S_WORKLOADS=(
  auth-service
  tenant-service
  memory-service
  knowledge-service
  billing-service
  payment-service
  audit-service
  privacy-service
  ops-admin-service
)
NODE_K8S_WORKLOADS=(node2-runtime)

group_exists() {
  case "${1:-}" in
    web|cms|node|java|all) return 0 ;;
    *) return 1 ;;
  esac
}

group_services() {
  local group="${1:-all}"
  case "${group}" in
    web)
      printf '%s\n' "${WEB_SERVICES[@]}"
      ;;
    cms)
      if [[ ${#CMS_SERVICES[@]} -gt 0 ]]; then
        printf '%s\n' "${CMS_SERVICES[@]}"
      fi
      ;;
    node)
      printf '%s\n' "${NODE_SERVICES[@]}"
      ;;
    java)
      printf '%s\n' "${JAVA_INFRA_SERVICES[@]}" "${JAVA_APP_SERVICES[@]}"
      ;;
    all)
      printf '%s\n' "${WEB_SERVICES[@]}" "${NODE_SERVICES[@]}" "${JAVA_INFRA_SERVICES[@]}" "${JAVA_APP_SERVICES[@]}"
      ;;
    *)
      return 1
      ;;
  esac
}

require_env_file() {
  if [[ ! -f "${ENV_FILE}" ]]; then
    echo "Missing ${ENV_FILE}."
    exit 1
  fi
}

services_csv_for_message() {
  local group="${1:-all}"
  local services=()
  local item
  while IFS= read -r item; do
    [[ -n "${item}" ]] && services+=("${item}")
  done < <(group_services "${group}")
  if [[ ${#services[@]} -eq 0 ]]; then
    echo "(none)"
    return 0
  fi
  local joined=""
  for item in "${services[@]}"; do
    if [[ -z "${joined}" ]]; then
      joined="${item}"
    else
      joined="${joined}, ${item}"
    fi
  done
  echo "${joined}"
}

run_compose_group_up() {
  local group="${1:-all}"
  local services=()
  local service
  while IFS= read -r service; do
    [[ -n "${service}" ]] && services+=("${service}")
  done < <(group_services "${group}")
  if [[ ${#services[@]} -eq 0 ]]; then
    echo "Group '${group}' currently has no deployable services configured."
    return 0
  fi

  cd "${ROOT_DIR}/deploy/compose"
  docker compose --env-file "${ENV_FILE}" -f "${COMPOSE_FILE}" up -d --build "${services[@]}"
}

run_compose_group_logs() {
  local group="${1:-all}"
  local service_name="${2:-}"

  if [[ -n "${service_name}" ]]; then
    cd "${ROOT_DIR}/deploy/compose"
    docker compose --env-file "${ENV_FILE}" -f "${COMPOSE_FILE}" logs -f --tail=200 "${service_name}"
    return 0
  fi

  local services=()
  local service
  while IFS= read -r service; do
    [[ -n "${service}" ]] && services+=("${service}")
  done < <(group_services "${group}")
  if [[ ${#services[@]} -eq 0 ]]; then
    echo "Group '${group}' currently has no deployable services configured."
    return 0
  fi

  cd "${ROOT_DIR}/deploy/compose"
  docker compose --env-file "${ENV_FILE}" -f "${COMPOSE_FILE}" logs -f --tail=200 "${services[@]}"
}

group_k8s_workloads() {
  local group="${1:-all}"
  case "${group}" in
    web)
      return 0
      ;;
    cms)
      return 0
      ;;
    node)
      printf '%s\n' "${NODE_K8S_WORKLOADS[@]}"
      ;;
    java)
      printf '%s\n' "${JAVA_K8S_WORKLOADS[@]}"
      ;;
    all)
      printf '%s\n' "${NODE_K8S_WORKLOADS[@]}" "${JAVA_K8S_WORKLOADS[@]}"
      ;;
    *)
      return 1
      ;;
  esac
}
