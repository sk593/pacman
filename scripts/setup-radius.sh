#!/usr/bin/env bash
# scripts/setup-radius.sh — Install Radius, register resource types, configure Recipes
# Usage:
#   ./scripts/setup-radius.sh
#
# Idempotent: safe to run multiple times.
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"

RAD_ENV="${RAD_ENV:-default}"
RAD_GROUP="${RAD_GROUP:-default}"
REGISTRY_NAME="${REGISTRY_NAME:-pacman-registry}"
REGISTRY_PORT="${REGISTRY_PORT:-5111}"

# For publishing from the host machine
PUBLISH_HOST="localhost:${REGISTRY_PORT}"

log() { echo "==> $*"; }
err() { echo "ERROR: $*" >&2; exit 1; }

# ---------------------------------------------------------------------------
# Resolve the registry IP on the k3d Docker network (bypass DNS issues)
# ---------------------------------------------------------------------------
get_registry_ip() {
  local cluster_name="${CLUSTER_NAME:-pacman-dev}"
  local network="k3d-${cluster_name}"
  local ip
  ip=$(docker inspect "${REGISTRY_NAME}" \
       --format "{{range \$net, \$config := .NetworkSettings.Networks}}{{if eq \$net \"${network}\"}}{{\$config.IPAddress}}{{end}}{{end}}" 2>/dev/null || true)
  if [[ -z "${ip}" ]]; then
    err "Cannot determine registry IP. Is the k3d cluster running?"
  fi
  echo "${ip}"
}

# ---------------------------------------------------------------------------
# Prerequisites
# ---------------------------------------------------------------------------
check_prereqs() {
  command -v kubectl >/dev/null 2>&1 || err "kubectl is required but not found."
  kubectl cluster-info >/dev/null 2>&1 || err "Cannot reach the Kubernetes API server. Run setup-cluster.sh first."
}

# ---------------------------------------------------------------------------
# Install rad CLI (if needed)
# ---------------------------------------------------------------------------
install_rad_cli() {
  if command -v rad >/dev/null 2>&1; then
    log "rad CLI already installed: $(rad version 2>/dev/null | head -1 || echo 'unknown version')"
    return
  fi

  log "Installing rad CLI..."
  curl -fsSL "https://raw.githubusercontent.com/radius-project/radius/main/deploy/install.sh" | bash -s
  export PATH="${HOME}/.rad/bin:${PATH}"

  command -v rad >/dev/null 2>&1 || err "Failed to install rad CLI."
  log "rad CLI installed."
}

# ---------------------------------------------------------------------------
# Install Radius control plane
# ---------------------------------------------------------------------------
install_radius() {
  if kubectl get namespace radius-system >/dev/null 2>&1; then
    log "Radius control plane already installed — skipping."
  else
    log "Installing Radius control plane..."
    rad install kubernetes --set rp.publicEndpointOverride=localhost
    log "Radius installed."
  fi
}

# ---------------------------------------------------------------------------
# Initialize Radius environment
# ---------------------------------------------------------------------------
init_environment() {
  # Check if environment already exists
  if rad env show "${RAD_ENV}" -g "${RAD_GROUP}" >/dev/null 2>&1; then
    log "Radius environment '${RAD_ENV}' already exists — skipping init."
  else
    log "Initializing Radius environment '${RAD_ENV}'..."
    rad group create "${RAD_GROUP}" 2>/dev/null || true
    rad env create "${RAD_ENV}" --group "${RAD_GROUP}"
    log "Radius environment '${RAD_ENV}' created."
  fi

  # Set defaults
  rad group switch "${RAD_GROUP}" 2>/dev/null || true
  rad env switch "${RAD_ENV}" 2>/dev/null || true
  rad workspace switch "${RAD_GROUP}" 2>/dev/null || true
}

# ---------------------------------------------------------------------------
# Register custom resource types and publish Bicep extensions
# ---------------------------------------------------------------------------
register_resource_types() {
  local types_dir="${REPO_ROOT}/infra/resource-types"

  log "Registering custom resource types..."

  for yaml_file in "${types_dir}"/*.yaml; do
    local name
    name="$(basename "${yaml_file}" .yaml)"
    log "  Registering resource type from ${name}.yaml..."
    rad resource-type create -f "${yaml_file}" 2>/dev/null \
      || log "  Resource type from ${name}.yaml may already exist (skipping)."
  done

  log "Resource types registered."

  # Publish Bicep extensions from resource type YAML definitions
  # (following the resource-types-contrib pattern)
  log "Publishing Bicep extensions for custom resource types..."
  for yaml_file in "${types_dir}"/*.yaml; do
    local name target
    name="$(basename "${yaml_file}" .yaml)"
    target="${REPO_ROOT}/${name}-extension.tgz"
    log "  Publishing Bicep extension: ${name} -> ${target}..."
    rad bicep publish-extension -f "${yaml_file}" --target "${target}" --force 2>/dev/null \
      || log "  Failed to publish extension for ${name}."
  done

  # Create/update bicepconfig.json at repo root
  log "Updating bicepconfig.json with published extensions..."
  local bicepconfig="${REPO_ROOT}/bicepconfig.json"

  # Start with base config
  cat > "${bicepconfig}" << 'BICEPEOF'
{
  "extensions": {
    "radius": "br:biceptypes.azurecr.io/radius:latest",
    "aws": "br:biceptypes.azurecr.io/aws:latest"
  }
}
BICEPEOF

  # Add each extension .tgz to the config
  for tgz_file in "${REPO_ROOT}"/*-extension.tgz; do
    [[ -f "${tgz_file}" ]] || continue
    local filename ext_name rel_path
    filename="$(basename "${tgz_file}")"
    ext_name="${filename%-extension.tgz}"
    rel_path="./${filename}"
    log "  Adding extension '${ext_name}' -> '${rel_path}'"
    jq --arg name "${ext_name}" --arg path "${rel_path}" \
      '.extensions[$name] = $path' "${bicepconfig}" > "${bicepconfig}.tmp" \
      && mv "${bicepconfig}.tmp" "${bicepconfig}"
  done

  log "bicepconfig.json updated."
}

# ---------------------------------------------------------------------------
# Publish Recipes to local OCI registry and register with environment
# ---------------------------------------------------------------------------
register_recipes() {
  local recipes_dir="${REPO_ROOT}/infra/recipes"

  log "Publishing Recipes to local OCI registry (${PUBLISH_HOST})..."

  # Publish recipes to local OCI registry via host port
  local recipe_files=(
    "kubernetes-containers"
    "kubernetes-postgresql"
    "kubernetes-redis"
    "kubernetes-aimodel"
    "kubernetes-blobstore"
    "kubernetes-functions"
  )

  for recipe_name in "${recipe_files[@]}"; do
    local recipe_file="${recipes_dir}/${recipe_name}.bicep"
    if [[ ! -f "${recipe_file}" ]]; then
      log "  Skipping ${recipe_name} — file not found."
      continue
    fi
    log "  Publishing ${recipe_name} Recipe..."
    rad bicep publish \
      --file "${recipe_file}" \
      --target "br:${PUBLISH_HOST}/radius-recipes/${recipe_name}:latest" \
      --plain-http \
      || err "Failed to publish ${recipe_name} recipe."
  done

  log "Recipes published to OCI registry."

  # Resolve the registry IP on the Docker network to bypass DNS resolution
  # issues in the Radius deployment engine (bicep-de uses 10.0.0.10 DNS
  # which is unreachable from pods on macOS/Docker Desktop + k3d)
  local registry_ip
  registry_ip="$(get_registry_ip)"
  local registry_internal="${registry_ip}:5000"
  log "Registry internal address: ${registry_internal}"

  # Register recipes using the direct IP (avoids DNS resolution entirely)
  log "Registering Recipes with Radius environment..."

  local recipe_registrations=(
    "Radius.Compute/containers:kubernetes-containers"
    "Radius.Data/postgreSqlDatabases:kubernetes-postgresql"
    "Radius.Data/redisCaches:kubernetes-redis"
    "Radius.AI/models:kubernetes-aimodel"
    "Radius.Storage/blobStores:kubernetes-blobstore"
    "Radius.Compute/functions:kubernetes-functions"
  )

  for entry in "${recipe_registrations[@]}"; do
    local resource_type="${entry%%:*}"
    local recipe_name="${entry##*:}"
    log "  Registering default Recipe for ${resource_type}..."
    rad recipe register default \
      --resource-type "${resource_type}" \
      --template-kind "bicep" \
      --template-path "${registry_internal}/radius-recipes/${recipe_name}:latest" \
      --plain-http \
      --group "${RAD_GROUP}" \
      --environment "${RAD_ENV}" 2>/dev/null \
      || log "  ${resource_type} Recipe may already be registered (skipping)."
  done

  log "Recipes registered."
}

# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------
main() {
  check_prereqs
  install_rad_cli
  install_radius
  init_environment
  register_resource_types
  register_recipes

  log "Radius setup complete."
  log "  Environment: ${RAD_ENV}"
  log "  Group: ${RAD_GROUP}"
  log "  Resource types: containers, postgreSqlDatabases, redisCaches, models, blobStores, functions"
  log "  Recipes: kubernetes-containers, kubernetes-postgresql, kubernetes-redis, kubernetes-aimodel, kubernetes-blobstore, kubernetes-functions"
}

main "$@"
