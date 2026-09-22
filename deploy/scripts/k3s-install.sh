#!/usr/bin/env bash
set -euo pipefail

K3S_CHANNEL="${K3S_CHANNEL:-stable}"
INGRESS_NGINX_VERSION="${INGRESS_NGINX_VERSION:-controller-v1.11.3}"
K3S_INGRESS_EXPOSE_MODE="${K3S_INGRESS_EXPOSE_MODE:-nodePort}"
K3S_INGRESS_HTTP_NODEPORT="${K3S_INGRESS_HTTP_NODEPORT:-30080}"
K3S_INGRESS_HTTPS_NODEPORT="${K3S_INGRESS_HTTPS_NODEPORT:-30443}"

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

curl -sfL https://get.k3s.io | INSTALL_K3S_CHANNEL="${K3S_CHANNEL}" sh -s - server \
  --write-kubeconfig-mode 644 \
  --disable traefik \
  --disable servicelb

export KUBECONFIG=/etc/rancher/k3s/k3s.yaml
run_root kubectl wait --for=condition=Ready node --all --timeout=300s

run_root kubectl apply -f "https://raw.githubusercontent.com/kubernetes/ingress-nginx/${INGRESS_NGINX_VERSION}/deploy/static/provider/baremetal/deploy.yaml"

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
EOF
if [[ "${K3S_INGRESS_EXPOSE_MODE}" == "hostNetwork" ]]; then
  echo "- Ingress controller mode: hostNetwork (ingress-nginx binds host 80/443)"
else
  echo "- Ingress controller mode: nodePort"
  echo "- HTTP nodePort: ${K3S_INGRESS_HTTP_NODEPORT}"
  echo "- HTTPS nodePort: ${K3S_INGRESS_HTTPS_NODEPORT}"
  echo "- For an existing host nginx, proxy to http://127.0.0.1:${K3S_INGRESS_HTTP_NODEPORT}"
fi
