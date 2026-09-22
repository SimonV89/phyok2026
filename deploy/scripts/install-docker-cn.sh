#!/usr/bin/env bash
set -euo pipefail

TENCENT_DOCKER_REPO_URL="${TENCENT_DOCKER_REPO_URL:-https://mirrors.cloud.tencent.com/docker-ce/linux/centos/docker-ce.repo}"
TENCENT_DOCKER_REPO_REWRITE_FROM="${TENCENT_DOCKER_REPO_REWRITE_FROM:-download.docker.com}"
TENCENT_DOCKER_REPO_REWRITE_TO="${TENCENT_DOCKER_REPO_REWRITE_TO:-mirrors.tencentyun.com/docker-ce}"
DOCKER_REGISTRY_MIRROR_PRIMARY="${DOCKER_REGISTRY_MIRROR_PRIMARY:-https://ccr.ccs.tencentyun.com}"
DOCKER_REGISTRY_MIRROR_SECONDARY="${DOCKER_REGISTRY_MIRROR_SECONDARY:-https://mirror.ccs.tencentyun.com}"

if [[ "$(uname -s)" != "Linux" ]]; then
  echo "install-docker-cn.sh only supports Linux."
  exit 1
fi

SUDO=""
if [[ "${EUID}" -ne 0 ]]; then
  SUDO="sudo"
fi

run_root() {
  if [[ -n "${SUDO}" ]]; then
    sudo "$@"
  else
    "$@"
  fi
}

command_exists() {
  command -v "$1" >/dev/null 2>&1
}

configure_registry_mirror() {
  run_root mkdir -p /etc/docker
  cat <<EOF | run_root tee /etc/docker/daemon.json >/dev/null
{
  "registry-mirrors": [
    "${DOCKER_REGISTRY_MIRROR_PRIMARY}",
    "${DOCKER_REGISTRY_MIRROR_SECONDARY}"
  ],
  "features": {
    "buildkit": true
  }
}
EOF
}

install_rpm_docker() {
  local pkg_mgr=""
  local config_mgr_cmd=""

  if command_exists dnf; then
    pkg_mgr="dnf"
    config_mgr_cmd="dnf config-manager"
    run_root dnf install -y dnf-plugins-core || true
  elif command_exists yum; then
    pkg_mgr="yum"
    config_mgr_cmd="yum-config-manager"
    run_root yum install -y yum-utils || true
  else
    echo "Unsupported RPM system: neither dnf nor yum is available."
    exit 1
  fi

  if ! command_exists ${config_mgr_cmd%% *}; then
    echo "Missing repo manager command: ${config_mgr_cmd}"
    exit 1
  fi

  run_root bash -lc "${config_mgr_cmd} --add-repo=${TENCENT_DOCKER_REPO_URL}"
  if [[ -f /etc/yum.repos.d/docker-ce.repo ]]; then
    run_root sed -i "s|${TENCENT_DOCKER_REPO_REWRITE_FROM}|${TENCENT_DOCKER_REPO_REWRITE_TO}|g" /etc/yum.repos.d/docker-ce.repo
  fi

  run_root ${pkg_mgr} clean all || true
  run_root ${pkg_mgr} makecache || true
  run_root ${pkg_mgr} install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin --nobest
}

install_deb_docker() {
  echo "Debian/Ubuntu auto-install is not implemented in this script yet."
  echo "Current focus is Tencent Cloud RPM family systems such as OpenCloudOS/TencentOS/CentOS."
  exit 1
}

if command_exists docker; then
  echo "[INFO] docker command already exists, only refreshing Tencent mirror configuration."
else
  if [[ -f /etc/os-release ]]; then
    # shellcheck disable=SC1091
    . /etc/os-release
  fi

  case "${ID_LIKE:-${ID:-}}" in
    *rhel*|*fedora*|*centos*|*opencloudos*|*tlinux*|*anolis*)
      install_rpm_docker
      ;;
    *debian*|*ubuntu*)
      install_deb_docker
      ;;
    *)
      if command_exists dnf || command_exists yum; then
        install_rpm_docker
      else
        install_deb_docker
      fi
      ;;
  esac
fi

configure_registry_mirror
run_root systemctl daemon-reload || true
run_root systemctl enable docker || true
run_root systemctl restart docker

echo "[INFO] Docker with Tencent mirrors is ready."
echo "[INFO] Repo: ${TENCENT_DOCKER_REPO_URL}"
echo "[INFO] Registry mirrors: ${DOCKER_REGISTRY_MIRROR_PRIMARY}, ${DOCKER_REGISTRY_MIRROR_SECONDARY}"
