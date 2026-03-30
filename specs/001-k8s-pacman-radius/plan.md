# Implementation Plan: Cloud-Native Pac-Man on Kubernetes with Radius

**Branch**: `001-k8s-pacman-radius` | **Date**: 2026-02-20 | **Spec**: [spec.md](spec.md)
**Input**: Feature specification from `/specs/001-k8s-pacman-radius/spec.md`

## Summary

Build a browser-playable Pac-Man game faithful to the 1980 arcade original, deployed as a cloud-native application on Azure Kubernetes Service (AKS) via Radius. The system consists of three application components (TypeScript/Vite frontend served by Nginx, Go backend API, Go score-processor worker) backed by Azure managed services: Azure Database for PostgreSQL Flexible Server, Azure Cache for Redis, Azure OpenAI, and Azure Blob Storage — all provisioned through Radius Recipes. Deployment is orchestrated through `rad deploy` with shell scripts for AKS cluster setup, Radius installation, and teardown.

## Technical Context

**Language/Version**: TypeScript 5.x (frontend), Go 1.22+ (backend), Bicep (infrastructure)
**Primary Dependencies**: Vite 6.x (build), HTML5 Canvas 2D (rendering), jackc/pgx/v5 (PostgreSQL driver), golang.org/x/time/rate (rate limiting), log/slog (structured logging)
**Storage**: Azure Database for PostgreSQL Flexible Server — provisioned via Radius Recipe
**Cache**: Azure Cache for Redis — provisioned via Radius Recipe
**AI**: Azure OpenAI — provisioned via Radius Recipe
**Blob Storage**: Azure Blob Storage — provisioned via Radius Recipe
**Testing**: Vitest (frontend unit), Go stdlib `testing` (backend unit), shell-based smoke tests (deployment)
**Target Platform**: Azure Kubernetes Service (AKS)
**Project Type**: Web application (frontend + backend + infra)
**Performance Goals**: 60 FPS game rendering, <100ms input latency, <2s score submission round-trip, <3s initial page load
**Constraints**: Container images <100MB each, 50 concurrent leaderboard requests without degradation, Azure managed services for all backing infrastructure
**Registry Policy**: All OCI artifacts (images, Recipes, Bicep extensions) MUST be published to Azure Container Registry (ACR). Never push to public/remote registries without explicit approval.
**Scale/Scope**: Single-player browser game, 1 PostgreSQL instance, 1 Redis cache, 1 AI model, 1 blob store, 7 Radius-managed resources (frontend, backend, score processor, database, cache, AI model, blob store)

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

### Pre-Research Check

| # | Principle | Status | Evidence |
|---|-----------|--------|----------|
| I | Cloud-Native First | PASS | Application containers run on AKS; backing services are Azure managed resources; config via env vars; health endpoints `/healthz`, `/readyz` on backend |
| II | Radius-Managed Deployments (NON-NEGOTIABLE) | PASS | All resources defined as Radius custom types (`Radius.Compute/containers`, `Radius.Data/postgreSqlDatabases`, `Radius.Data/redisCaches`, `Radius.AI/models`, `Radius.Storage/blobStores`); deployed via `rad deploy`; no raw `kubectl apply`. `kubectl` permitted for diagnostics/debugging only. |
| III | Container-First Architecture | PASS | Frontend: multi-stage Node→Nginx (distroless-like). Backend: multi-stage Go→distroless. No secrets in images. |
| IV | Infrastructure as Code | PASS | `infra/app.bicep` for Radius Application; `infra/recipes/` for Bicep Recipes (Azure-backed); `infra/resource-types/` for YAML definitions; all version-controlled |
| V | Observability | PASS | Backend: `/healthz` + `/readyz` endpoints; structured JSON logs via `log/slog`; Prometheus metrics and OpenTelemetry deferred to future iteration |
| VI | Simplicity & Portability | PASS | 7 resources total; Radius abstractions decouple app from Azure specifics; YAGNI applied (no auth, no multiplayer, no sound) |

### Post-Design Check

| # | Principle | Status | Evidence |
|---|-----------|--------|----------|
| I | Cloud-Native First | PASS | Stateless frontend + backend on AKS; all stateful services are Azure managed (PostgreSQL Flexible Server, Azure Cache for Redis, Azure Blob Storage). Health probes configured. Env vars for all config. |
| II | Radius-Managed Deployments | PASS | `app.bicep` defines 7 resources using `extension radius` + `extension containers` + `extension postgreSqlDatabases` + `extension redisCaches` + `extension models` + `extension blobStores` + `extension functions`. Connections auto-inject `CONNECTION_*` env vars. Recipes provision Azure managed services. All deployment via `rad deploy`; `kubectl` for diagnostics only. |
| III | Container-First Architecture | PASS | Frontend: `node:22-alpine` build → `nginx:1.27-alpine` serve (non-root). Backend: `golang:1.22-bookworm` build → `gcr.io/distroless/static-debian12:nonroot`. Multi-stage builds confirmed. |
| IV | Infrastructure as Code | PASS | `infra/app.bicep`, `infra/recipes/azure-postgresql.bicep`, `infra/recipes/azure-redis.bicep`, `infra/recipes/azure-aimodel.bicep`, `infra/recipes/azure-blobstore.bicep`, `infra/recipes/kubernetes-containers.bicep`, `infra/recipes/kubernetes-functions.bicep`, `infra/resource-types/*.yaml` — all in repo. |
| V | Observability | PASS | `GET /healthz` (liveness, no dependency check), `GET /readyz` (readiness, pings DB). `slog.NewJSONHandler` for structured JSON. K8s probes configured in container Recipe. |
| VI | Simplicity & Portability | PASS | No external router library (Go 1.22 ServeMux). No UI framework (raw Canvas). Radius abstractions decouple app logic from Azure provider specifics. |

**Gate result**: ALL PASS — no violations to justify.

## Project Structure

### Documentation (this feature)

```text
specs/001-k8s-pacman-radius/
├── plan.md              # This file
├── research.md          # Phase 0 output — technology research (5 topics)
├── data-model.md        # Phase 1 output — entities, DDL, state machines
├── quickstart.md        # Phase 1 output — 8-step deploy guide
├── contracts/
│   └── score-api.openapi.yaml  # Phase 1 output — OpenAPI 3.1 contract
└── tasks.md             # Phase 2 output (/speckit.tasks command)
```

### Source Code (repository root)

```text
frontend/
├── index.html                # Entry point
├── package.json              # Dependencies: vite, typescript, vitest
├── tsconfig.json             # target: ES2022, strict: true
├── vite.config.ts            # Vite build config
├── nginx.conf                # Custom Nginx config (gzip, SPA fallback, security headers)
├── Dockerfile                # Multi-stage: node:22-alpine → nginx:1.27-alpine
└── src/
    ├── main.ts               # Entry: canvas setup, game loop init
    ├── game.ts               # Game state machine (start → playing → dying → gameover)
    ├── maze.ts               # 28×31 grid data, wall collision, pellet tracking
    ├── pacman.ts             # Pac-Man entity: movement, animation, input queue
    ├── ghost.ts              # Ghost base class: movement, mode transitions
    ├── ghost-ai.ts           # Blinky/Pinky/Inky/Clyde target tile algorithms
    ├── input.ts              # Keyboard (arrow/WASD) + mouse input handler
    ├── renderer.ts           # Canvas 2D drawing: maze, sprites, HUD, start screen
    ├── sprites.ts            # Sprite sheet loading and frame mapping
    ├── audio.ts              # Stub module (no-op for MVP, future sound hook)
    ├── score-client.ts       # HTTP client: GET/POST /api/scores
    ├── types.ts              # Shared types: Direction, Tile, GameState, Ghost interface
    └── constants.ts          # Grid size, speeds, timers, point values

backend/
├── go.mod                    # Module: github.com/<org>/pacman/backend
├── go.sum
├── Dockerfile                # Multi-stage: golang:1.22-bookworm → distroless:nonroot
├── cmd/
│   └── server/
│       └── main.go           # Entry: config, DB pool, router, server start
├── internal/
│   ├── api/
│   │   ├── handler.go        # HTTP handlers: GetLeaderboard, SubmitScore
│   │   ├── middleware.go     # RateLimit, SecurityHeaders, RequestID, Logging
│   │   └── router.go        # ServeMux setup with middleware chain
│   ├── db/
│   │   ├── postgres.go       # pgxpool connection, retry logic, Ping
│   │   └── migrate.go        # Embedded SQL schema migration (embed package)
│   ├── model/
│   │   └── score.go          # HighScoreEntry struct, validation
│   └── config/
│       └── config.go         # Env var parsing: CONNECTION_DB_*, PORT, LOG_LEVEL
└── sql/
    └── 001_create_scores.sql # DDL: CREATE TABLE scores, CREATE INDEX

infra/
├── app.bicep                 # Radius Application: frontend + backend + all Azure-backed services
├── recipes/
│   ├── kubernetes-containers.bicep      # AKS Deployment + Service recipe (compute)
│   ├── kubernetes-functions.bicep       # AKS worker Deployment recipe (compute)
│   ├── azure-postgresql.bicep           # Azure Database for PostgreSQL Flexible Server recipe
│   ├── azure-redis.bicep                # Azure Cache for Redis recipe
│   ├── azure-aimodel.bicep              # Azure OpenAI model recipe
│   └── azure-blobstore.bicep            # Azure Blob Storage recipe
└── resource-types/
    ├── containers.yaml                   # Radius.Compute/containers type def
    ├── postgreSqlDatabases.yaml          # Radius.Data/postgreSqlDatabases type def
    ├── redisCaches.yaml                  # Radius.Data/redisCaches type def
    ├── models.yaml                       # Radius.AI/models type def
    ├── blobStores.yaml                   # Radius.Storage/blobStores type def
    └── functions.yaml                    # Radius.Compute/functions type def

score-processor/
├── go.mod                    # Module: score processing worker
├── Dockerfile                # Multi-stage Go build
└── cmd/
    └── main.go               # Entry: Redis queue consumer → PostgreSQL writer

scripts/
├── setup-cluster.sh          # Create AKS cluster and Azure Container Registry
├── setup-radius.sh           # Install Radius, register types, configure Azure-backed Recipes
├── build.sh                  # Build frontend + backend + score-processor images, push to ACR
├── deploy.sh                 # rad deploy infra/app.bicep
└── teardown.sh               # rad app delete + optional cluster and Azure resource teardown
```

**Structure Decision**: Web application layout with `frontend/`, `backend/`, `score-processor/`, and `infra/` at the repository root. This separates the TypeScript game (compiled to static assets served by Nginx) from the Go score API and the Bicep infrastructure definitions. The `scripts/` directory provides the operator experience defined in User Stories 3 and 4. Recipes provision Azure managed services (PostgreSQL Flexible Server, Azure Cache for Redis, Azure OpenAI, Azure Blob Storage) instead of local Kubernetes pods, ensuring production-grade reliability and managed SLAs.

## Complexity Tracking

> No constitution violations detected. All 6 gates PASS at both pre-research and post-design checkpoints. No complexity justifications required.

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|-------------------------------------|
| *(none)* | — | — |
