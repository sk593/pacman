#!/usr/bin/env bash
# scripts/teardown.sh — Remove Radius resources and optionally the cluster
# Usage:
#   ./scripts/teardown.sh                  # Delete Radius app + resources
#   ./scripts/teardown.sh --delete-cluster # Also delete the k3d cluster + registry
#
# Idempotent: safe to run multiple times.
set -euo pipefail

CLUSTER_NAME="${CLUSTER_NAME:-pacman-dev}"
REGISTRY_NAME="${REGISTRY_NAME:-pacman-registry}"
RAD_ENV="${RAD_ENV:-default}"
RAD_GROUP="${RAD_GROUP:-default}"

log() { echo "==> $*"; }
warn() { echo "WARN: $*" >&2; }

DELETE_CLUSTER=false
for arg in "$@"; do
  case "${arg}" in
    --delete-cluster) DELETE_CLUSTER=true ;;
  esac
done

# ---------------------------------------------------------------------------
# Delete Radius application and resources
# ---------------------------------------------------------------------------
delete_radius_app() {
  if command -v rad >/dev/null 2>&1; then
    log "Deleting Radius application 'pacman'..."
    rad app delete pacman --group "${RAD_GROUP}" --yes 2>/dev/null \
      || warn "Application 'pacman' not found or already deleted."

    log "Deleting Radius environment '${RAD_ENV}'..."
    rad env delete "${RAD_ENV}" --group "${RAD_GROUP}" --yes 2>/dev/null \
      || warn "Environment '${RAD_ENV}' not found or already deleted."

    log "Radius resources cleaned up."
  else
    warn "rad CLI not found — skipping Radius resource deletion."
  fi
}

# ---------------------------------------------------------------------------
# Uninstall Radius control plane
# ---------------------------------------------------------------------------
uninstall_radius() {
  if command -v rad >/dev/null 2>&1 && kubectl get namespace radius-system >/dev/null 2>&1; then
    log "Uninstalling Radius control plane..."
    rad uninstall kubernetes 2>/dev/null \
      || warn "Failed to uninstall Radius (may already be removed)."
    log "Radius uninstalled."
  fi
}

# ---------------------------------------------------------------------------
# Delete cluster
# ---------------------------------------------------------------------------
delete_cluster() {
  if command -v k3d >/dev/null 2>&1; then
    if k3d cluster list 2>/dev/null | grep -q "^${CLUSTER_NAME} "; then
      log "Deleting k3d cluster '${CLUSTER_NAME}'..."
      k3d cluster delete "${CLUSTER_NAME}"
      log "k3d cluster deleted."
    else
      log "k3d cluster '${CLUSTER_NAME}' not found — nothing to delete."
    fi
  else
    warn "k3d not found — cannot delete cluster."
  fi
}

# ---------------------------------------------------------------------------
# Delete k3d registry
# ---------------------------------------------------------------------------
delete_registry() {
  if command -v k3d >/dev/null 2>&1; then
    if k3d registry list 2>/dev/null | grep -q "${REGISTRY_NAME}"; then
      log "Deleting k3d registry '${REGISTRY_NAME}'..."
      k3d registry delete "${REGISTRY_NAME}"
      log "k3d registry deleted."
    else
      log "k3d registry '${REGISTRY_NAME}' not found — nothing to delete."
    fi
  fi
}

# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------
main() {
  delete_radius_app
  uninstall_radius

  if [[ "${DELETE_CLUSTER}" == true ]]; then
    delete_cluster
    delete_registry
  else
    log "Cluster preserved. Use --delete-cluster to also remove the cluster."
  fi

  log "Teardown complete."
}

main "$@"
