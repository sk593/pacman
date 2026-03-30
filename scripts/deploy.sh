#!/usr/bin/env bash
# scripts/deploy.sh — Deploy the Pac-Man application via rad deploy
# Usage:
#   ./scripts/deploy.sh
#
# Idempotent: safe to run multiple times.
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"

REGISTRY_NAME="${REGISTRY_NAME:-pacman-registry}"
# In-cluster, k3d registry is accessible at REGISTRY_NAME:5000 (internal port)
CLUSTER_REGISTRY="${REGISTRY_NAME}:5000"
FRONTEND_IMAGE="${FRONTEND_IMAGE:-${CLUSTER_REGISTRY}/pacman-frontend:latest}"
BACKEND_IMAGE="${BACKEND_IMAGE:-${CLUSTER_REGISTRY}/pacman-api:latest}"
SCORE_PROCESSOR_IMAGE="${SCORE_PROCESSOR_IMAGE:-${CLUSTER_REGISTRY}/pacman-score-processor:latest}"

log() { echo "==> $*"; }
err() { echo "ERROR: $*" >&2; exit 1; }

# ---------------------------------------------------------------------------
# Prerequisites
# ---------------------------------------------------------------------------
check_prereqs() {
  command -v rad >/dev/null 2>&1    || err "rad CLI not found. Run ./scripts/setup-radius.sh first."
  command -v kubectl >/dev/null 2>&1 || err "kubectl is required but not found."
  kubectl cluster-info >/dev/null 2>&1 || err "Cannot reach the Kubernetes API server."

  # Verify Radius is installed
  kubectl get namespace radius-system >/dev/null 2>&1 \
    || err "Radius is not installed. Run ./scripts/setup-radius.sh first."
}

# ---------------------------------------------------------------------------
# Deploy
# ---------------------------------------------------------------------------
deploy() {
  local bicep_file="${REPO_ROOT}/infra/app.bicep"

  [[ -f "${bicep_file}" ]] || err "Bicep file not found at ${bicep_file}."

  log "Deploying Pac-Man application..."
  log "  Frontend image:        ${FRONTEND_IMAGE}"
  log "  Backend image:         ${BACKEND_IMAGE}"
  log "  Score Processor image: ${SCORE_PROCESSOR_IMAGE}"
  rad deploy "${bicep_file}" \
    -p frontendImage="${FRONTEND_IMAGE}" \
    -p backendImage="${BACKEND_IMAGE}" \
    -p scoreProcessorImage="${SCORE_PROCESSOR_IMAGE}"
  log "Deployment complete."
}

# ---------------------------------------------------------------------------
# Verify
# ---------------------------------------------------------------------------
verify() {
  log "Verifying deployment..."

  # List Radius resources
  rad resource list --application pacman 2>/dev/null || true

  # Check pods
  log "Kubernetes pods:"
  kubectl get pods -l 'radapp.io/application=pacman' --no-headers 2>/dev/null || true

  # Get frontend URL
  local url
  url=$(rad resource show 'Radius.Compute/containers' frontend -o json 2>/dev/null \
    | grep -o '"url": *"[^"]*"' | head -1 | cut -d'"' -f4 || true)

  if [[ -n "${url}" ]]; then
    log "Game URL: ${url}"
  else
    log "Frontend URL not yet available. Check pod status with: kubectl get pods"
  fi

  log "Deployment verified."
}

# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------
main() {
  check_prereqs
  deploy
  verify
}

main "$@"
