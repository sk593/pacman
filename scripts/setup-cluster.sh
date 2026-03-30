#!/usr/bin/env bash
# scripts/setup-cluster.sh — Create a local k3d cluster with integrated registry
# Usage:
#   ./scripts/setup-cluster.sh
#
# Idempotent: safe to run multiple times.
set -euo pipefail

CLUSTER_NAME="${CLUSTER_NAME:-pacman-dev}"
REGISTRY_NAME="${REGISTRY_NAME:-pacman-registry}"
REGISTRY_PORT="${REGISTRY_PORT:-5111}"
K3D_IMAGE="${K3D_IMAGE:-rancher/k3s:v1.30.4-k3s1}"

log() { echo "==> $*"; }
err() { echo "ERROR: $*" >&2; exit 1; }

# ---------------------------------------------------------------------------
# Prerequisites
# ---------------------------------------------------------------------------
check_prereqs() {
  local missing=()
  command -v docker >/dev/null 2>&1 || missing+=("docker")
  command -v k3d >/dev/null 2>&1    || missing+=("k3d")

  if (( ${#missing[@]} > 0 )); then
    err "Missing prerequisites: ${missing[*]}. Install them and retry."
  fi

  docker info >/dev/null 2>&1 || err "Docker is not running. Start Docker Desktop and retry."
}

# ---------------------------------------------------------------------------
# Create k3d cluster with integrated registry
# ---------------------------------------------------------------------------
create_cluster() {
  if k3d cluster list 2>/dev/null | grep -q "^${CLUSTER_NAME} "; then
    log "k3d cluster '${CLUSTER_NAME}' already exists — skipping creation."
  else
    log "Creating k3d cluster '${CLUSTER_NAME}' with registry '${REGISTRY_NAME}:${REGISTRY_PORT}'..."
    k3d cluster create "${CLUSTER_NAME}" \
      --image "${K3D_IMAGE}" \
      --wait \
      --timeout 120s \
      --api-port 6550 \
      -p "8080:80@loadbalancer" \
      --agents 1 \
      --registry-create "${REGISTRY_NAME}:${REGISTRY_PORT}"
    log "k3d cluster '${CLUSTER_NAME}' created with integrated registry."
  fi

  # Set kubectl context
  kubectl config use-context "k3d-${CLUSTER_NAME}" >/dev/null 2>&1 \
    || err "Failed to set kubectl context to k3d-${CLUSTER_NAME}."
  log "kubectl context set to k3d-${CLUSTER_NAME}."
}

# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------
main() {
  check_prereqs
  create_cluster

  # Verify connectivity
  log "Verifying cluster connectivity..."
  kubectl cluster-info >/dev/null 2>&1 || err "Cannot reach the Kubernetes API server."
  log "Cluster is ready."
  log ""
  log "Registry: localhost:${REGISTRY_PORT} (host) / ${REGISTRY_NAME}:5000 (in-cluster)"
  log "Next step: ./scripts/setup-radius.sh"
}

main "$@"
