#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "${SCRIPT_DIR}/../.." && pwd)"

K3S_CHANNEL="${K3S_CHANNEL:-stable}"
K3S_INSTALL_SCRIPT_URL="${K3S_INSTALL_SCRIPT_URL:-https://rancher-mirror.rancher.cn/k3s/k3s-install.sh}"
K3S_INSTALL_MIRROR="${K3S_INSTALL_MIRROR:-cn}"
INSTALL_K3S_SELINUX_WARN="${INSTALL_K3S_SELINUX_WARN:-true}"
INGRESS_NGINX_VERSION="${INGRESS_NGINX_VERSION:-controller-v1.11.3}"
INGRESS_NGINX_MANIFEST_PATH="${INGRESS_NGINX_MANIFEST_PATH:-${ROOT_DIR}/deploy/k8s/vendor/ingress-nginx-controller-v1.11.3-baremetal.yaml}"
INGRESS_NGINX_CONTROLLER_IMAGE="${INGRESS_NGINX_CONTROLLER_IMAGE:-}"
INGRESS_NGINX_WEBHOOK_IMAGE="${INGRESS_NGINX_WEBHOOK_IMAGE:-}"
K3S_REGISTRY_DOCKER_MIRROR_PRIMARY="${K3S_REGISTRY_DOCKER_MIRROR_PRIMARY:-https://ccr.ccs.tencentyun.com}"
K3S_REGISTRY_DOCKER_MIRROR_SECONDARY="${K3S_REGISTRY_DOCKER_MIRROR_SECONDARY:-https://mirror.ccs.tencentyun.com}"
K3S_REGISTRY_K8S_MIRROR="${K3S_REGISTRY_K8S_MIRROR:-}"
K3S_REGISTRY_GHCR_MIRROR="${K3S_REGISTRY_GHCR_MIRROR:-}"
K3S_REGISTRY_QUAY_MIRROR="${K3S_REGISTRY_QUAY_MIRROR:-}"
K3S_INGRESS_EXPOSE_MODE="${K3S_INGRESS_EXPOSE_MODE:-nodePort}"
K3S_INGRESS_HTTP_NODEPORT="${K3S_INGRESS_HTTP_NODEPORT:-30080}"
K3S_INGRESS_HTTPS_NODEPORT="${K3S_INGRESS_HTTPS_NODEPORT:-30443}"
TENCENT_DOCKER_REPO_URL="${TENCENT_DOCKER_REPO_URL:-https://mirrors.cloud.tencent.com/docker-ce/linux/centos/docker-ce.repo}"
TENCENT_DOCKER_REPO_REWRITE_FROM="${TENCENT_DOCKER_REPO_REWRITE_FROM:-download.docker.com}"
TENCENT_DOCKER_REPO_REWRITE_TO="${TENCENT_DOCKER_REPO_REWRITE_TO:-mirrors.tencentyun.com/docker-ce}"

if [[ "$(uname -s)" != "Linux" ]]; then
  echo "k3s-install.sh only supports Linux."
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

configure_docker_mirror() {
  if ! command -v docker >/dev/null 2>&1; then
    return 0
  fi

  run_root mkdir -p /etc/docker
  if [[ -f /etc/docker/daemon.json && ! -f /etc/docker/daemon.json.phyok.bak ]]; then
    run_root cp /etc/docker/daemon.json /etc/docker/daemon.json.phyok.bak
  fi

  cat <<EOF | run_root tee /etc/docker/daemon.json >/dev/null
{
  "registry-mirrors": [
    "${K3S_REGISTRY_DOCKER_MIRROR_PRIMARY}",
    "${K3S_REGISTRY_DOCKER_MIRROR_SECONDARY}"
  ],
  "features": {
    "buildkit": true
  }
}
EOF

  run_root systemctl daemon-reload || true
  run_root systemctl restart docker || true
}

configure_k3s_registries() {
  run_root mkdir -p /etc/rancher/k3s
  cat <<EOF | run_root tee /etc/rancher/k3s/registries.yaml >/dev/null
mirrors:
  docker.io:
    endpoint:
      - "${K3S_REGISTRY_DOCKER_MIRROR_PRIMARY}"
      - "${K3S_REGISTRY_DOCKER_MIRROR_SECONDARY}"
EOF

  if [[ -n "${K3S_REGISTRY_K8S_MIRROR}" ]]; then
    cat <<EOF | run_root tee -a /etc/rancher/k3s/registries.yaml >/dev/null
  registry.k8s.io:
    endpoint:
      - "${K3S_REGISTRY_K8S_MIRROR}"
EOF
  fi

  if [[ -n "${K3S_REGISTRY_GHCR_MIRROR}" ]]; then
    cat <<EOF | run_root tee -a /etc/rancher/k3s/registries.yaml >/dev/null
  ghcr.io:
    endpoint:
      - "${K3S_REGISTRY_GHCR_MIRROR}"
EOF
  fi

  if [[ -n "${K3S_REGISTRY_QUAY_MIRROR}" ]]; then
    cat <<EOF | run_root tee -a /etc/rancher/k3s/registries.yaml >/dev/null
  quay.io:
    endpoint:
      - "${K3S_REGISTRY_QUAY_MIRROR}"
EOF
  fi
}

prepare_ingress_manifest() {
  local target_file="$1"
  cp "${INGRESS_NGINX_MANIFEST_PATH}" "${target_file}"

  if [[ -n "${INGRESS_NGINX_CONTROLLER_IMAGE}" ]]; then
    sed -i '' "s|image: registry.k8s.io/ingress-nginx/controller:.*|image: ${INGRESS_NGINX_CONTROLLER_IMAGE}|" "${target_file}" 2>/dev/null \
      || sed -i "s|image: registry.k8s.io/ingress-nginx/controller:.*|image: ${INGRESS_NGINX_CONTROLLER_IMAGE}|" "${target_file}"
  fi

  if [[ -n "${INGRESS_NGINX_WEBHOOK_IMAGE}" ]]; then
    sed -i '' "s|image: registry.k8s.io/ingress-nginx/kube-webhook-certgen:.*|image: ${INGRESS_NGINX_WEBHOOK_IMAGE}|" "${target_file}" 2>/dev/null \
      || sed -i "s|image: registry.k8s.io/ingress-nginx/kube-webhook-certgen:.*|image: ${INGRESS_NGINX_WEBHOOK_IMAGE}|" "${target_file}"
  fi
}

repair_rpm_docker_repo() {
  if [[ ! -d /etc/yum.repos.d ]]; then
    return 0
  fi

  local docker_repo_file="/etc/yum.repos.d/docker-ce.repo"
  local pkg_mgr=""

  if command -v dnf >/dev/null 2>&1; then
    pkg_mgr="dnf"
    run_root dnf install -y dnf-plugins-core >/dev/null 2>&1 || true
    run_root bash -lc "dnf config-manager --add-repo=${TENCENT_DOCKER_REPO_URL}" >/dev/null 2>&1 || true
  elif command -v yum >/dev/null 2>&1; then
    pkg_mgr="yum"
    run_root yum install -y yum-utils >/dev/null 2>&1 || true
    run_root bash -lc "yum-config-manager --add-repo=${TENCENT_DOCKER_REPO_URL}" >/dev/null 2>&1 || true
  else
    return 0
  fi

  if [[ -f "${docker_repo_file}" ]]; then
    run_root sed -i "s|${TENCENT_DOCKER_REPO_REWRITE_FROM}|${TENCENT_DOCKER_REPO_REWRITE_TO}|g" "${docker_repo_file}" || true
    run_root ${pkg_mgr} clean all >/dev/null 2>&1 || true
  fi
}

run_root mkdir -p /etc/rancher/k3s
run_root modprobe overlay || true
run_root modprobe br_netfilter || true

cat <<'EOF' | run_root tee /etc/sysctl.d/99-phyok-k3s.conf >/dev/null
net.bridge.bridge-nf-call-iptables = 1
net.bridge.bridge-nf-call-ip6tables = 1
net.ipv4.ip_forward = 1
vm.max_map_count = 262144
EOF
run_root sysctl --system >/dev/null
run_root swapoff -a || true

configure_docker_mirror
configure_k3s_registries
repair_rpm_docker_repo

curl -sfL "${K3S_INSTALL_SCRIPT_URL}" | INSTALL_K3S_CHANNEL="${K3S_CHANNEL}" INSTALL_K3S_MIRROR="${K3S_INSTALL_MIRROR}" INSTALL_K3S_SELINUX_WARN="${INSTALL_K3S_SELINUX_WARN}" sh -s - server \
  --write-kubeconfig-mode 644 \
  --disable traefik \
  --disable servicelb

export KUBECONFIG=/etc/rancher/k3s/k3s.yaml
run_root kubectl wait --for=condition=Ready node --all --timeout=300s

if [[ ! -f "${INGRESS_NGINX_MANIFEST_PATH}" ]]; then
  echo "Missing ingress manifest: ${INGRESS_NGINX_MANIFEST_PATH}"
  exit 1
fi

TMP_INGRESS_MANIFEST="$(mktemp)"
trap 'rm -f "${TMP_INGRESS_MANIFEST}"' EXIT
prepare_ingress_manifest "${TMP_INGRESS_MANIFEST}"
run_root kubectl apply -f "${TMP_INGRESS_MANIFEST}"

case "${K3S_INGRESS_EXPOSE_MODE}" in
  hostNetwork)
    run_root kubectl patch deployment ingress-nginx-controller -n ingress-nginx --type merge -p '{
      "spec": {
        "replicas": 1,
        "template": {
          "spec": {
            "hostNetwork": true,
            "dnsPolicy": "ClusterFirstWithHostNet"
          }
        }
      }
    }'
    run_root kubectl patch service ingress-nginx-controller -n ingress-nginx --type merge -p '{
      "spec": {
        "type": "ClusterIP"
      }
    }' || true
    ;;
  nodePort)
    run_root kubectl patch deployment ingress-nginx-controller -n ingress-nginx --type merge -p '{
      "spec": {
        "replicas": 1,
        "template": {
          "spec": {
            "hostNetwork": false,
            "dnsPolicy": "ClusterFirst"
          }
        }
      }
    }'
    run_root kubectl patch service ingress-nginx-controller -n ingress-nginx --type merge -p "{
      \"spec\": {
        \"type\": \"NodePort\",
        \"ports\": [
          {
            \"name\": \"http\",
            \"port\": 80,
            \"protocol\": \"TCP\",
            \"targetPort\": \"http\",
            \"nodePort\": ${K3S_INGRESS_HTTP_NODEPORT}
          },
          {
            \"name\": \"https\",
            \"port\": 443,
            \"protocol\": \"TCP\",
            \"targetPort\": \"https\",
            \"nodePort\": ${K3S_INGRESS_HTTPS_NODEPORT}
          }
        ]
      }
    }"
    ;;
  *)
    echo "Unsupported K3S_INGRESS_EXPOSE_MODE: ${K3S_INGRESS_EXPOSE_MODE}"
    echo "Supported values: hostNetwork | nodePort"
    exit 1
    ;;
esac
run_root kubectl rollout status deployment/ingress-nginx-controller -n ingress-nginx --timeout=300s

cat <<'EOF'
k3s single-node installation finished.
- Open Tencent Cloud security group ports: 80, 443, 6443
- Kubeconfig: /etc/rancher/k3s/k3s.yaml
- Docker mirror: Tencent Cloud mirror first
- k3s installer: Rancher China mirror
EOF
if [[ "${K3S_INGRESS_EXPOSE_MODE}" == "hostNetwork" ]]; then
  echo "- Ingress controller mode: hostNetwork (ingress-nginx binds host 80/443)"
else
  echo "- Ingress controller mode: nodePort"
  echo "- HTTP nodePort: ${K3S_INGRESS_HTTP_NODEPORT}"
  echo "- HTTPS nodePort: ${K3S_INGRESS_HTTPS_NODEPORT}"
  echo "- For an existing host nginx, proxy to http://127.0.0.1:${K3S_INGRESS_HTTP_NODEPORT}"
fi
