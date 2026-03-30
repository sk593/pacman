#!/usr/bin/env bash
# scripts/build.sh — Build container images and push to the local k3d registry
# Usage:
#   ./scripts/build.sh
#
# Idempotent: safe to run multiple times.
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"

REGISTRY_PORT="${REGISTRY_PORT:-5111}"
REGISTRY="localhost:${REGISTRY_PORT}"
FRONTEND_IMAGE="${FRONTEND_IMAGE:-${REGISTRY}/pacman-frontend:latest}"
BACKEND_IMAGE="${BACKEND_IMAGE:-${REGISTRY}/pacman-api:latest}"
SCORE_PROCESSOR_IMAGE="${SCORE_PROCESSOR_IMAGE:-${REGISTRY}/pacman-score-processor:latest}"

log() { echo "==> $*"; }
err() { echo "ERROR: $*" >&2; exit 1; }

# ---------------------------------------------------------------------------
# Prerequisites
# ---------------------------------------------------------------------------
check_prereqs() {
  command -v docker >/dev/null 2>&1 || err "docker is required but not found."
  docker info >/dev/null 2>&1      || err "Docker is not running."
}

# ---------------------------------------------------------------------------
# Build and push images to local registry
# ---------------------------------------------------------------------------
build_and_push() {
  log "Building frontend image: ${FRONTEND_IMAGE}"
  docker build \
    -t "${FRONTEND_IMAGE}" \
    -f "${REPO_ROOT}/frontend/Dockerfile" \
    "${REPO_ROOT}/frontend"

  log "Building backend image: ${BACKEND_IMAGE}"
  docker build \
    -t "${BACKEND_IMAGE}" \
    -f "${REPO_ROOT}/backend/Dockerfile" \
    "${REPO_ROOT}/backend"

  log "Building score-processor image: ${SCORE_PROCESSOR_IMAGE}"
  docker build \
    -t "${SCORE_PROCESSOR_IMAGE}" \
    -f "${REPO_ROOT}/score-processor/Dockerfile" \
    "${REPO_ROOT}/score-processor"

  log "Images built successfully."

  log "Pushing images to local registry (${REGISTRY})..."
  docker push "${FRONTEND_IMAGE}"
  docker push "${BACKEND_IMAGE}"
  docker push "${SCORE_PROCESSOR_IMAGE}"
  log "Images pushed to ${REGISTRY}."
}

# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------
main() {
  check_prereqs
  build_and_push
  log ""
  log "Images ready:"
  log "  Frontend:        ${FRONTEND_IMAGE}"
  log "  Backend:         ${BACKEND_IMAGE}"
  log "  Score Processor: ${SCORE_PROCESSOR_IMAGE}"
  log ""
  log "Next step: ./scripts/deploy.sh"
}

main "$@"
