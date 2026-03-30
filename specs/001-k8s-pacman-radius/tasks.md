# Tasks: Cloud-Native Pac-Man on Kubernetes with Radius

**Input**: Design documents from `/specs/001-k8s-pacman-radius/`
**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/score-api.openapi.yaml, quickstart.md

**Tests**: Not explicitly requested in spec — test tasks omitted. Smoke tests are covered by quickstart.md validation in the Polish phase.

**Organization**: Tasks are grouped by user story (US1–US4) to enable independent implementation and testing of each story.

## Format: `[ID] [P?] [Story?] Description`

- **[P]**: Can run in parallel (different files, no dependencies on incomplete tasks)
- **[Story]**: Which user story this task belongs to (US1, US2, US3, US4)
- Exact file paths included in all descriptions

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Create project directory structure and initialize both language projects

- [X] T001 Create project directory structure per plan.md (frontend/src/, backend/cmd/server/, backend/internal/api/, backend/internal/db/, backend/internal/model/, backend/internal/config/, backend/sql/, infra/recipes/, infra/resource-types/, scripts/)
- [X] T002 Initialize frontend TypeScript/Vite project with package.json (exact versions, no ^ or ~ ranges per FR-025), tsconfig.json, vite.config.ts, and index.html in frontend/
- [X] T003 [P] Initialize backend Go module with go.mod (pinned dependency versions per FR-025, commit go.sum) in backend/

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Shared types, database layer, API skeleton, health endpoints, and Dockerfiles that ALL user stories depend on

**CRITICAL**: No user story work can begin until this phase is complete

- [X] T004 [P] Define shared TypeScript types (Direction, Tile, GameState, GhostName, GhostMode) in frontend/src/types.ts
- [X] T005 [P] Define game constants (grid dimensions 28x31, tile size, speeds, timers, point values, lives) in frontend/src/constants.ts
- [X] T006 [P] Create environment variable config parser (CONNECTION_DB_*, PORT, LOG_LEVEL) in backend/internal/config/config.go
- [X] T007 [P] Create SQL schema migration (CREATE TABLE scores, CREATE INDEX idx_scores_desc) in backend/sql/001_create_scores.sql
- [X] T008 Implement PostgreSQL connection pool with retry logic using pgxpool in backend/internal/db/postgres.go
- [X] T009 Implement embedded SQL migration runner using Go embed package in backend/internal/db/migrate.go
- [X] T010 [P] Implement request-ID generation and structured JSON request-logging middleware using slog in backend/internal/api/middleware.go
- [X] T011 Implement health check handlers (GET /healthz liveness, GET /readyz with DB ping) in backend/internal/api/handler.go
- [X] T012 Create API router with middleware chain and health endpoint registration in backend/internal/api/router.go
- [X] T013 Wire server entry point (config load, DB pool init, migration, router, graceful shutdown) in backend/cmd/server/main.go
- [X] T014 [P] Create frontend Dockerfile (node:22-alpine build stage, nginx:1.27-alpine serve stage) and nginx.conf (gzip, SPA fallback, security headers, reverse proxy: `proxy_pass /api/ → http://backend:8080/api/` so frontend and backend share the same origin) in frontend/
- [X] T015 [P] Create backend Dockerfile (golang:1.22-bookworm build stage, gcr.io/distroless/static-debian12:nonroot run stage) in backend/

**Checkpoint**: Backend starts, serves /healthz and /readyz, connects to PostgreSQL, runs migration. Both Dockerfiles build. Foundation ready — user story implementation can begin.

---

## Phase 3: User Story 1 — Play Pac-Man in a Browser (Priority: P1) MVP

**Goal**: Deliver a fully playable Pac-Man game in the browser with original arcade visuals, four ghosts with classic AI, arrow/WASD/mouse controls, and a 60fps game loop

**Independent Test**: Open frontend/index.html via `npm run dev`; verify start screen renders; click to start; verify arrow keys, WASD, and mouse move Pac-Man; verify ghosts move with distinct behaviors; verify pellet consumption, power pellets, ghost-eating, life loss, level advancement, and game-over screen

### Implementation for User Story 1

- [X] T016 [P] [US1] Implement 28x31 maze grid data, wall collision detection, pellet tracking, and tunnel wrapping in frontend/src/maze.ts
- [X] T017 [P] [US1] Implement keyboard (ArrowUp/Down/Left/Right, WASD) and mouse click input handler with direction queuing in frontend/src/input.ts
- [X] T018 [P] [US1] Create sprite sheet loader and frame mapping for Pac-Man, ghosts, pellets, and maze tiles in frontend/src/sprites.ts
- [X] T019 [P] [US1] Create audio stub module (no-op exports for future sound hook) in frontend/src/audio.ts
- [X] T020 [US1] Implement Pac-Man entity with tile-based movement, direction queue, wall collision, animation frames, and respawn logic in frontend/src/pacman.ts
- [X] T021 [US1] Implement ghost base class with movement, scatter/chase/frightened/eaten mode transitions, and mode timer in frontend/src/ghost.ts
- [X] T022 [US1] Implement ghost AI targeting algorithms (Blinky direct chase, Pinky 4-tile ambush, Inky Blinky-relative flank, Clyde shy retreat) in frontend/src/ghost-ai.ts
- [X] T023 [US1] Implement Canvas 2D renderer for maze walls, pellets, Pac-Man sprite, ghost sprites, HUD (score, lives, level), start screen, and game-over screen in frontend/src/renderer.ts
- [X] T024 [US1] Implement game state machine (start, playing, dying, gameover, levelcomplete, paused) with 60fps requestAnimationFrame loop, delta-time accumulator, and level progression in frontend/src/game.ts
- [X] T025 [US1] Wire entry point: create canvas element, initialize game, bind input handler, start game loop in frontend/src/main.ts

**Checkpoint**: Game is fully playable in browser via `npm run dev`. Start screen shows, input works, ghosts behave correctly, levels advance, game ends on life loss. No backend needed yet.

---

## Phase 4: User Story 2 — Persist and View High Scores (Priority: P2)

**Goal**: After game-over, player submits a name (1–10 chars) and score is persisted to PostgreSQL via the Go backend API. Start screen displays top-10 leaderboard. Scores survive pod restarts.

**Independent Test**: Run backend locally with PostgreSQL; POST a score via curl; GET /api/scores and verify it appears. In the browser, complete a game, submit a name, reload — verify score persists on leaderboard.

### Implementation for User Story 2

- [X] T026 [P] [US2] Create HighScoreEntry struct and input validation (name regex, score > 0, level >= 1, sanitization) in backend/internal/model/score.go
- [X] T027 [P] [US2] Implement security headers middleware (CSP, X-Content-Type-Options, X-Frame-Options, HSTS, Referrer-Policy) and rate-limit middleware (10 req/min per IP using x/time/rate) in backend/internal/api/middleware.go
- [X] T028 [US2] Implement GetLeaderboard (SELECT top 10 DESC) and SubmitScore (INSERT with validation) HTTP handlers in backend/internal/api/handler.go
- [X] T029 [US2] Register GET /api/scores and POST /api/scores endpoints with rate-limit and security middleware in backend/internal/api/router.go
- [X] T030 [P] [US2] Implement score HTTP client (fetchLeaderboard, submitScore with error handling and graceful degradation) in frontend/src/score-client.ts
- [X] T031 [US2] Integrate high-score display on start screen (fetch top scores on load) and score-submission form on game-over screen (name input, submit, confirmation) in frontend/src/game.ts and frontend/src/renderer.ts

**Checkpoint**: Full-stack flow works: game-over → name entry → POST → score persisted → reload → leaderboard shows score. Backend rate-limits and sets security headers. Scores survive container restart.

---

## Phase 5: User Story 3 — Deploy the Entire Application with Scripts (Priority: P3)

**Goal**: Platform engineer clones repo, runs three scripts (setup-cluster, setup-radius, deploy), and the entire Pac-Man application is running on Kubernetes via Radius with custom resource types and Recipes

**Independent Test**: On a macOS machine with Docker, run `./scripts/setup-cluster.sh`, `./scripts/setup-radius.sh`, `./scripts/build.sh`, `./scripts/deploy.sh` in sequence. Verify `rad resource list --application pacman` shows 3 resources provisioned. Open the game URL and play.

### Implementation for User Story 3

- [X] T032 [P] [US3] Create Radius.Compute/containers resource type YAML definition (apiVersion 2025-08-01-preview) in infra/resource-types/containers.yaml
- [X] T033 [P] [US3] Create Radius.Data/postgreSqlDatabases resource type YAML definition (apiVersion 2025-08-01-preview) in infra/resource-types/postgreSqlDatabases.yaml
- [X] T034 [P] [US3] Implement Kubernetes PostgreSQL Bicep Recipe (postgres:16-alpine Deployment + ClusterIP Service, size-based memory, credential outputs) in infra/recipes/kubernetes-postgresql.bicep
- [X] T035 [P] [US3] Implement Kubernetes container Bicep Recipe (Deployment + Service, CONNECTION_* env injection, liveness + readiness probes for ALL containers including frontend on GET /, labels) in infra/recipes/kubernetes-containers.bicep
- [X] T036 [US3] Define Radius Application Bicep (app + frontend container + backend container with DB connection + postgreSqlDatabases resource) in infra/app.bicep
- [X] T037 [P] [US3] Create cluster setup script (k3d create/AKS connect, kubectl context, idempotent) in scripts/setup-cluster.sh
- [X] T038 [US3] Create Radius setup script (rad install, resource-type create, recipe register, environment config, idempotent) in scripts/setup-radius.sh
- [X] T039 [P] [US3] Create container image build script (docker build frontend + backend, k3d image import) in scripts/build.sh
- [X] T040 [US3] Create deployment script (prerequisite checks, rad deploy infra/app.bicep, status verification) in scripts/deploy.sh

**Checkpoint**: Three-script deploy works end-to-end: cluster created, Radius installed with custom types + Recipes, `rad deploy` provisions all resources, game accessible at service URL. `rad resource list` shows 3 healthy resources.

---

## Phase 6: User Story 4 — Tear Down the Environment Cleanly (Priority: P4)

**Goal**: Operator runs a single teardown script to remove all Radius resources and optionally destroy the cluster, leaving zero orphaned resources

**Independent Test**: After a successful deploy, run `./scripts/teardown.sh`. Verify `rad resource list` returns empty. Run with `--delete-cluster` and verify the k3d cluster is removed from `docker ps`.

### Implementation for User Story 4

- [X] T041 [US4] Create teardown script (rad app delete, rad env delete, optional --delete-cluster for k3d/AKS, verification, idempotent) in scripts/teardown.sh

**Checkpoint**: Teardown removes all Radius resources. With `--delete-cluster`, the cluster is also removed. No orphaned containers, volumes, or namespaces remain.

---

## Phase 7: Polish & Cross-Cutting Concerns

**Purpose**: Documentation, validation, and cleanup across all user stories

- [X] T042 [P] Add README.md at repository root with project overview, architecture diagram, and link to quickstart.md
- [X] T043 Validate end-to-end deployment flow against specs/001-k8s-pacman-radius/quickstart.md (all 8 steps)
- [X] T044 [P] Run lint and format pass across all source files (frontend: eslint + prettier, backend: gofmt + go vet)

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies — start immediately
- **Foundational (Phase 2)**: Depends on Phase 1 — BLOCKS all user stories
- **US1 (Phase 3)**: Depends on Phase 2 (types.ts, constants.ts, Dockerfile)
- **US2 (Phase 4)**: Depends on Phase 2 (DB layer, middleware, handler.go). Can run in parallel with US1 for backend tasks; frontend integration (T030-T031) depends on US1 game being functional
- **US3 (Phase 5)**: Depends on Phase 2 (Dockerfiles). Can start infra tasks (T032-T036) in parallel with US1/US2; scripts (T037-T040) need working container images
- **US4 (Phase 6)**: Depends on US3 (deploy script must work first to test teardown)
- **Polish (Phase 7)**: Depends on all prior phases

### User Story Dependencies

- **US1 (P1)**: After Phase 2 — no dependencies on other stories (playable game standalone)
- **US2 (P2)**: After Phase 2 — backend tasks (T026-T029) independent of US1; frontend integration (T030-T031) benefits from US1 game being complete
- **US3 (P3)**: After Phase 2 — infra definitions (T032-T036) independent of US1/US2; scripts (T037-T040) need buildable images
- **US4 (P4)**: After US3 — teardown requires working deploy

### Within Each User Story

- Models/data before services
- Services before HTTP handlers
- Core game entities before renderer/game loop
- All parallel [P] tasks within a story can run simultaneously
- Story checkpoint before starting next priority

### Parallel Opportunities

**Phase 2 parallel batch**: T004 + T005 + T006 + T007 + T010 + T014 + T015 (7 tasks, all different files)

**US1 parallel batch**: T016 + T017 + T018 + T019 (4 tasks: maze, input, sprites, audio — all independent)

**US2 parallel batch**: T026 + T027 + T030 (model, middleware, frontend client — different languages/files)

**US3 parallel batch**: T032 + T033 + T034 + T035 + T037 + T039 (6 tasks: resource types, recipes, cluster script, build script — all independent files)

**Cross-story parallel**: Once Phase 2 is complete, US1 backend-independent tasks and US3 infra definitions can start simultaneously

---

## Parallel Example: User Story 1

```text
# Parallel batch 1 — all independent foundation files:
T016: Maze grid data and collision in frontend/src/maze.ts
T017: Input handler (arrow/WASD/mouse) in frontend/src/input.ts
T018: Sprite sheet loader in frontend/src/sprites.ts
T019: Audio stub in frontend/src/audio.ts

# Sequential — depends on maze + input:
T020: Pac-Man entity in frontend/src/pacman.ts
T021: Ghost base class in frontend/src/ghost.ts

# Sequential — depends on ghost base:
T022: Ghost AI targeting in frontend/src/ghost-ai.ts

# Sequential — depends on all entities + sprites:
T023: Canvas 2D renderer in frontend/src/renderer.ts

# Sequential — depends on all above:
T024: Game state machine + loop in frontend/src/game.ts
T025: Entry point wiring in frontend/src/main.ts
```

## Parallel Example: User Story 3

```text
# Parallel batch 1 — all independent infra files:
T032: containers.yaml resource type definition
T033: postgreSqlDatabases.yaml resource type definition
T034: PostgreSQL Bicep Recipe
T035: Container Bicep Recipe
T037: Cluster setup script
T039: Build script

# Sequential — depends on resource types + recipes:
T036: app.bicep application definition

# Sequential — depends on resource types, recipes, app.bicep:
T038: Radius setup script (registers types + recipes)
T040: Deploy script (runs rad deploy)
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup (T001–T003)
2. Complete Phase 2: Foundational (T004–T015) — CRITICAL, blocks all stories
3. Complete Phase 3: User Story 1 (T016–T025)
4. **STOP and VALIDATE**: Game is playable in browser via `npm run dev`
5. This is a standalone, demoable MVP

### Incremental Delivery

1. Setup + Foundational → Foundation ready
2. Add US1 → Playable game in browser (MVP!)
3. Add US2 → Leaderboard with persistent scores (full-stack demo)
4. Add US3 → One-command deployment on Kubernetes via Radius
5. Add US4 → Clean teardown
6. Polish → README, quickstart validation, lint
7. Each story adds value without breaking previous stories

### Parallel Team Strategy

With multiple developers:

1. Team completes Setup + Foundational together
2. Once Foundational is done:
   - Developer A: US1 (frontend game)
   - Developer B: US2 backend tasks (T026–T029)
   - Developer C: US3 infra tasks (T032–T036)
3. Developer B picks up US2 frontend integration (T030–T031) after Developer A finishes US1
4. Developer C completes US3 scripts (T037–T040) after images are buildable
5. Anyone: US4 (single task) after US3 deploy works

---

## Notes

- [P] tasks = different files, no dependencies on incomplete tasks in the same phase
- [Story] label maps task to specific user story for traceability
- Each user story is independently testable at its checkpoint
- No test tasks generated (not requested in spec); quickstart.md validation covers E2E smoke test
- Commit after each task or logical group
- All scripts must be idempotent per FR-018
- Container images must be <100MB each per SC-008
