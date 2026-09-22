#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PUBLIC_HOST="${PUBLIC_HOST:-www.phyok.com}"

"${SCRIPT_DIR}/k3s-install-host-nginx.sh"
PUBLIC_HOST="${PUBLIC_HOST}" "${SCRIPT_DIR}/k3s-project-up.sh"
