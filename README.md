# Cloud-Native Pac-Man on Kubernetes with Radius

A browser-playable Pac-Man game faithful to the 1980 arcade original, deployed as a cloud-native application on Kubernetes via [Radius](https://radapp.io).

## Architecture

```
┌──────────────┐    ┌──────────────┐    ┌──────────────┐
│   Frontend   │    │   Backend    │    │  PostgreSQL   │
│  (Nginx)     │───▶│  (Go API)    │───▶│  (postgres)   │
│  port 80     │    │  port 8080   │    │  port 5432    │
└──────────────┘    └──────────────┘    └──────────────┘
       │                   │                   │
       └───────── Radius.Compute/containers ───┘
                                    Radius.Data/postgreSqlDatabases
```

| Component | Technology | Image |
|-----------|-----------|-------|
| Frontend | TypeScript + Vite → Nginx static | `nginx:1.27-alpine` |
| Backend | Go 1.22+ Score API | `gcr.io/distroless/static-debian12:nonroot` |
| Database | PostgreSQL 16 | `postgres:16-alpine` |

All resources are managed by Radius using custom resource types and Bicep Recipes.

## Quickstart

> **Prerequisites**: macOS with Docker Desktop running

```bash
# 1. Create a Kubernetes cluster
./scripts/setup-cluster.sh

# 2. Install Radius and register resource types
./scripts/setup-radius.sh

# 3. Build container images
./scripts/build.sh

# 4. Deploy the application
./scripts/deploy.sh
```

For the full step-by-step guide, see [specs/001-k8s-pacman-radius/quickstart.md](specs/001-k8s-pacman-radius/quickstart.md).

## Play

Open the game URL (printed by `deploy.sh`) in your browser:

- **Arrow keys** or **WASD** — move Pac-Man
- **Mouse click** — move toward click position
- **Any key / click** — start game from title screen

## Project Structure

```
frontend/                  # TypeScript Pac-Man game
├── src/                   # Game source (Canvas 2D, 60fps loop, ghost AI)
├── Dockerfile             # node:22-alpine → nginx:1.27-alpine
└── nginx.conf             # Gzip, SPA fallback, reverse proxy to backend

backend/                   # Go score API
├── cmd/server/main.go     # Entry point with graceful shutdown
├── internal/              # API handlers, DB, config, middleware
├── sql/                   # PostgreSQL schema migration
└── Dockerfile             # golang:1.22 → distroless:nonroot

infra/                     # Radius infrastructure as code
├── app.bicep              # Application definition (3 resources)
├── recipes/               # Bicep Recipes for Kubernetes
│   ├── kubernetes-containers.bicep
│   └── kubernetes-postgresql.bicep
└── resource-types/        # Custom Radius resource type definitions
    ├── containers.yaml
    └── postgreSqlDatabases.yaml

scripts/                   # Operator scripts (all idempotent)
├── setup-cluster.sh       # Create k3d cluster or connect to AKS
├── setup-radius.sh        # Install Radius, register types, configure Recipes
├── build.sh               # Build frontend + backend Docker images
├── deploy.sh              # rad deploy infra/app.bicep
└── teardown.sh            # Clean removal of all resources
```

## Tear Down

```bash
# Remove Radius app and resources
./scripts/teardown.sh

# Also delete the k3d cluster
./scripts/teardown.sh --delete-cluster
```

## API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/healthz` | Liveness probe |
| `GET` | `/readyz` | Readiness probe (pings DB) |
| `GET` | `/api/scores` | Top 10 leaderboard |
| `POST` | `/api/scores` | Submit a new score |

## Design Documents

Full specification and design documents are in [specs/001-k8s-pacman-radius/](specs/001-k8s-pacman-radius/):

- [spec.md](specs/001-k8s-pacman-radius/spec.md) — Feature specification
- [plan.md](specs/001-k8s-pacman-radius/plan.md) — Implementation plan
- [research.md](specs/001-k8s-pacman-radius/research.md) — Technical research
- [data-model.md](specs/001-k8s-pacman-radius/data-model.md) — Data model
- [contracts/score-api.openapi.yaml](specs/001-k8s-pacman-radius/contracts/score-api.openapi.yaml) — API contract
- [quickstart.md](specs/001-k8s-pacman-radius/quickstart.md) — Deployment guide
- [tasks.md](specs/001-k8s-pacman-radius/tasks.md) — Task breakdown

## License

See [LICENSE](LICENSE) for details.
