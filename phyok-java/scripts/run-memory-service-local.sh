#!/usr/bin/env bash

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
LOCAL_POSTGRES_CONTAINER="${LOCAL_POSTGRES_CONTAINER:-phyok-local-postgres}"
LOCAL_POSTGRES_IMAGE="${LOCAL_POSTGRES_IMAGE:-postgres:16}"
LOCAL_POSTGRES_PORT="${LOCAL_POSTGRES_PORT:-15432}"

PHYOK_POSTGRES_DB="${PHYOK_POSTGRES_DB:-phyok}"
PHYOK_POSTGRES_USER="${PHYOK_POSTGRES_USER:-phyok}"
PHYOK_POSTGRES_PASSWORD="${PHYOK_POSTGRES_PASSWORD:-change_me_pg}"
MEMORY_PORT="${MEMORY_PORT:-18182}"

resolve_java_home() {
  if [[ -n "${JAVA_HOME:-}" ]] && [[ -x "${JAVA_HOME}/bin/java" ]]; then
    "${JAVA_HOME}/bin/java" -version 2>&1 | grep -q 'version "21\.' && {
      printf '%s\n' "${JAVA_HOME}"
      return 0
    }
  fi

  local homebrew_java="/opt/homebrew/opt/openjdk@21/libexec/openjdk.jdk/Contents/Home"
  if [[ -x "${homebrew_java}/bin/java" ]]; then
    printf '%s\n' "${homebrew_java}"
    return 0
  fi

  echo "JDK 21 not found. Install via Homebrew: brew install openjdk@21" >&2
  exit 1
}

ensure_local_postgres() {
  docker image inspect "${LOCAL_POSTGRES_IMAGE}" >/dev/null 2>&1 || docker pull "${LOCAL_POSTGRES_IMAGE}" >/dev/null

  if ! docker inspect "${LOCAL_POSTGRES_CONTAINER}" >/dev/null 2>&1; then
    docker run -d \
      --name "${LOCAL_POSTGRES_CONTAINER}" \
      -e POSTGRES_DB="${PHYOK_POSTGRES_DB}" \
      -e POSTGRES_USER="${PHYOK_POSTGRES_USER}" \
      -e POSTGRES_PASSWORD="${PHYOK_POSTGRES_PASSWORD}" \
      -p "${LOCAL_POSTGRES_PORT}:5432" \
      "${LOCAL_POSTGRES_IMAGE}" >/dev/null
  else
    local running
    running="$(docker inspect "${LOCAL_POSTGRES_CONTAINER}" --format '{{.State.Running}}')"
    if [[ "${running}" != "true" ]]; then
      docker start "${LOCAL_POSTGRES_CONTAINER}" >/dev/null
    fi
  fi

  for _ in {1..30}; do
    if docker exec "${LOCAL_POSTGRES_CONTAINER}" pg_isready -U "${PHYOK_POSTGRES_USER}" -d "${PHYOK_POSTGRES_DB}" >/dev/null 2>&1; then
      return 0
    fi
    sleep 1
  done

  echo "Local Docker PostgreSQL did not become ready: ${LOCAL_POSTGRES_CONTAINER}" >&2
  exit 1
}

ensure_local_postgres

for _ in {1..20}; do
  if (echo >/dev/tcp/127.0.0.1/"${LOCAL_POSTGRES_PORT}") >/dev/null 2>&1; then
    break
  fi
  sleep 1
done

if ! (echo >/dev/tcp/127.0.0.1/"${LOCAL_POSTGRES_PORT}") >/dev/null 2>&1; then
  echo "Docker PostgreSQL did not become reachable on 127.0.0.1:${LOCAL_POSTGRES_PORT}" >&2
  exit 1
fi

echo "[memory-local] docker db container: ${LOCAL_POSTGRES_CONTAINER}"
echo "[memory-local] docker db host: 127.0.0.1:${LOCAL_POSTGRES_PORT}"

export JAVA_HOME
JAVA_HOME="$(resolve_java_home)"
export PATH="${JAVA_HOME}/bin:${PATH}"
export SPRING_DATASOURCE_URL="jdbc:postgresql://127.0.0.1:${LOCAL_POSTGRES_PORT}/${PHYOK_POSTGRES_DB}?sslmode=disable"
export SPRING_DATASOURCE_USERNAME="${PHYOK_POSTGRES_USER}"
export SPRING_DATASOURCE_PASSWORD="${PHYOK_POSTGRES_PASSWORD}"

cd "${ROOT_DIR}"

echo "[memory-local] JAVA_HOME=${JAVA_HOME}"
echo "[memory-local] booting memory-service on :${MEMORY_PORT}"

exec ./gradlew :apps:memory-service:bootRun --args="--server.port=${MEMORY_PORT}"
