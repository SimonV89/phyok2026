#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

export K3S_INGRESS_EXPOSE_MODE="${K3S_INGRESS_EXPOSE_MODE:-nodePort}"
export K3S_INGRESS_HTTP_NODEPORT="${K3S_INGRESS_HTTP_NODEPORT:-30080}"
export K3S_INGRESS_HTTPS_NODEPORT="${K3S_INGRESS_HTTPS_NODEPORT:-30443}"

"${SCRIPT_DIR}/k3s-install.sh"

cat <<EOF

Host nginx mode is ready.
- ingress-nginx http nodePort: ${K3S_INGRESS_HTTP_NODEPORT}
- ingress-nginx https nodePort: ${K3S_INGRESS_HTTPS_NODEPORT}
- host nginx config template: ${SCRIPT_DIR}/../nginx/phyok-host-nginx.conf

Next step:
PUBLIC_HOST=www.phyok.com ${SCRIPT_DIR}/k3s-project-up.sh
EOF
