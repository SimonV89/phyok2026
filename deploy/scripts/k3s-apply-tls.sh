#!/usr/bin/env bash
set -euo pipefail

DOMAIN="${1:-}"
CERT_FILE="${2:-}"
KEY_FILE="${3:-}"
NAMESPACE="${K8S_NAMESPACE:-phyok}"
SECRET_NAME="${TLS_SECRET_NAME:-phyok-platform-tls}"
INGRESS_NAME="${INGRESS_NAME:-phyok-platform-ingress}"

if [[ -z "${DOMAIN}" || -z "${CERT_FILE}" || -z "${KEY_FILE}" ]]; then
  echo "Usage: $0 <domain> <cert-file> <key-file>"
  exit 1
fi

if [[ ! -f "${CERT_FILE}" ]]; then
  echo "Missing cert file: ${CERT_FILE}"
  exit 1
fi

if [[ ! -f "${KEY_FILE}" ]]; then
  echo "Missing key file: ${KEY_FILE}"
  exit 1
fi

if ! command -v kubectl >/dev/null 2>&1; then
  echo "kubectl is required."
  exit 1
fi

kubectl create secret tls "${SECRET_NAME}" \
  -n "${NAMESPACE}" \
  --cert="${CERT_FILE}" \
  --key="${KEY_FILE}" \
  --dry-run=client -o yaml | kubectl apply -f -

kubectl patch ingress "${INGRESS_NAME}" -n "${NAMESPACE}" --type merge -p "{
  \"spec\": {
    \"tls\": [
      {
        \"hosts\": [\"${DOMAIN}\"],
        \"secretName\": \"${SECRET_NAME}\"
      }
    ]
  }
}"

echo "TLS secret '${SECRET_NAME}' applied to ingress '${INGRESS_NAME}' for host '${DOMAIN}'."
