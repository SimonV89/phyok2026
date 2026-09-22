#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck disable=SC1091
source "${SCRIPT_DIR}/common.sh"

GROUP="${1:-all}"
TARGET="${2:-}"
GRADLE_CACHE_DIR="${ROOT_DIR}/.gradle-k3s-cache"
GRADLE_IMAGE="${GRADLE_IMAGE:-gradle:8.10.2-jdk21}"

if ! group_exists "${GROUP}"; then
  echo "Usage: $0 {web|cms|node|java|all} [service-name]"
  exit 1
fi

if ! command -v docker >/dev/null 2>&1; then
  echo "docker is required."
  exit 1
fi

if ! command -v k3s >/dev/null 2>&1; then
  echo "k3s is required. Run deploy/scripts/k3s-install.sh first."
  exit 1
fi

mkdir -p "${GRADLE_CACHE_DIR}"

import_image() {
  local image="$1"
  echo "Importing ${image} into k3s containerd..."
  docker save "${image}" | sudo k3s ctr images import -
}

build_java_image() {
  local service="$1"
  local image="ghcr.io/your-org/phyok-${service}:latest"
  echo "Building Java image for ${service} -> ${image}"
  docker run --rm \
    -u "$(id -u):$(id -g)" \
    -e GRADLE_USER_HOME=/tmp/gradle-home \
    -v "${GRADLE_CACHE_DIR}:/tmp/gradle-home" \
    -v "${ROOT_DIR}/phyok-java:/workspace" \
    -v /var/run/docker.sock:/var/run/docker.sock \
    -w /workspace \
    "${GRADLE_IMAGE}" \
    gradle --no-daemon ":apps:${service}:bootBuildImage" "--imageName=${image}"
  import_image "${image}"
}

build_node_image() {
  local image="ghcr.io/your-org/phyok-node2-runtime:latest"
  echo "Building Node image -> ${image}"
  docker build -t "${image}" "${ROOT_DIR}/phyok-node2"
  import_image "${image}"
}

build_web_image() {
  local image="ghcr.io/your-org/phyok-chat-web:latest"
  echo "Building Web image -> ${image}"
  docker build -t "${image}" "${ROOT_DIR}/phyok-web/apps/chat-web"
  import_image "${image}"
}

run_target() {
  local item="$1"
  case "${item}" in
    node2-runtime)
      build_node_image
      ;;
    chat-web)
      build_web_image
      ;;
    auth-service|tenant-service|memory-service|knowledge-service|billing-service|payment-service|audit-service|privacy-service|ops-admin-service)
      build_java_image "${item}"
      ;;
    *)
      echo "Skipping unsupported target '${item}'."
      ;;
  esac
}

if [[ -n "${TARGET}" ]]; then
  run_target "${TARGET}"
  exit 0
fi

declare -a targets=()
case "${GROUP}" in
  web)
    targets=("${WEB_SERVICES[@]}")
    ;;
  cms)
    targets=("${CMS_SERVICES[@]}")
    ;;
  node)
    targets=("${NODE_SERVICES[@]}")
    ;;
  java)
    targets=("${JAVA_APP_SERVICES[@]}")
    ;;
  all)
    targets=("${WEB_SERVICES[@]}" "${NODE_SERVICES[@]}" "${JAVA_APP_SERVICES[@]}")
    ;;
esac

if [[ ${#targets[@]} -eq 0 ]]; then
  echo "Group '${GROUP}' currently has no image build targets configured."
  exit 0
fi

for target_name in "${targets[@]}"; do
  run_target "${target_name}"
done

echo "k3s image load finished for group '${GROUP}'."
