#!/usr/bin/env bash
set -euo pipefail

export COMPOSE_PROJECT_NAME="${COMPOSE_PROJECT_NAME:-spoofscope-e2e}"
export POSTGRES_PASSWORD="e2e-postgres-password"
export SPOOFSCOPE_API_KEY="e2e-api-key-2026"
export SPOOFSCOPE_PORT="18080"
export SPOOFSCOPE_CT_ENABLED="false"
export SPOOFSCOPE_SCREENSHOTS_ENABLED="false"
export SPOOFSCOPE_MAX_CANDIDATES="8"
export SPOOFSCOPE_SCAN_TIMEOUT_SECONDS="2"

cleanup() {
  if [[ "${E2E_KEEP_STACK:-false}" != "true" ]]; then
    docker compose down --volumes --remove-orphans >/dev/null 2>&1 || true
  fi
}
failure() {
  docker compose ps || true
  docker compose logs --no-color --tail=200 || true
}
trap cleanup EXIT
trap failure ERR

docker compose down --volumes --remove-orphans >/dev/null 2>&1 || true
docker compose up --detach --build

for _ in $(seq 1 90); do
  if curl --fail --silent http://127.0.0.1:18080/api/health >/dev/null; then
    break
  fi
  sleep 2
done
curl --fail --silent http://127.0.0.1:18080/api/health >/dev/null

docker compose exec -T api python scripts/seed_demo.py
curl --fail --silent -H "X-SpoofScope-Key: ${SPOOFSCOPE_API_KEY}" \
  http://127.0.0.1:18080/api/dashboard | grep -q 'northstar.example'

domain_id=$(curl --fail --silent -H 'Content-Type: application/json' \
  -H "X-SpoofScope-Key: ${SPOOFSCOPE_API_KEY}" \
  -d '{"name":"monitoring.example","label":"E2E scope","authorized":true}' \
  http://127.0.0.1:18080/api/domains | \
  docker compose exec -T api python -c 'import json,sys; print(json.load(sys.stdin)["id"])')

curl --fail --silent -X POST -H "X-SpoofScope-Key: ${SPOOFSCOPE_API_KEY}" \
  "http://127.0.0.1:18080/api/domains/${domain_id}/scan" >/dev/null

for _ in $(seq 1 90); do
  state=$(curl --fail --silent -H "X-SpoofScope-Key: ${SPOOFSCOPE_API_KEY}" \
    "http://127.0.0.1:18080/api/domains/${domain_id}" | \
    docker compose exec -T api python -c 'import json,sys; rows=json.load(sys.stdin)["scans"]; print(rows[0]["status"] if rows else "missing")')
  [[ "$state" == "completed" ]] && break
  [[ "$state" == "failed" ]] && exit 1
  sleep 2
done
[[ "$state" == "completed" ]]

curl --fail --silent -H "X-SpoofScope-Key: ${SPOOFSCOPE_API_KEY}" \
  http://127.0.0.1:18080/api/metrics | grep -q 'spoofscope_scans_total'
curl --fail --silent http://127.0.0.1:18080/ | grep -q 'root'
echo "SpoofScope Docker E2E passed"
