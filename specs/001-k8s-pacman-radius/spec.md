# Feature Specification: Cloud-Native Pac-Man on Kubernetes with Radius

**Feature Branch**: `001-k8s-pacman-radius`  
**Created**: 2026-02-20  
**Status**: Draft  
**Input**: User description: "Build a cloud-native version of the Pac-Man game that runs on Kubernetes, deployed entirely through Radius. All resources (containers, databases, etc.) must use Radius Recipes with custom Radius resource types (modeled after radius-project/resource-types-contrib). Provide scripts for cluster setup, Radius installation, and deployment. The game must be controllable via arrow keys on macOS, use the original Pac-Man visual theme, follow security best practices, and use a language chosen for efficiency and ease of use."

## User Scenarios & Testing *(mandatory)*

### User Story 1 – Play Pac-Man in a Browser (Priority: P1)

A player opens the game URL in their browser and is presented with a start screen faithful to the original Pac-Man arcade: the current high score is displayed at the top, a "Press anywhere to start" prompt invites the player to begin, and basic control instructions are shown ("Use your mouse, arrow keys, or WASD to move"). When the player clicks or presses any key, the classic Pac-Man maze loads. They use the arrow keys, WASD keys, or mouse on their Mac to move Pac-Man through the maze, eating pellets, avoiding ghosts, and collecting power pellets to turn the tables on ghosts. The game visuals match the original 1980 Pac-Man arcade theme. When all pellets are consumed the level advances; when all lives are lost the game ends and the player's score is displayed.

**Why this priority**: This is the core product — without a playable game nothing else matters.

**Independent Test**: Load the game URL in Safari or Chrome on macOS; verify the start screen renders with high score, instructions, and "Press anywhere to start" prompt; verify clicking or pressing a key starts the game; verify arrow keys, WASD, and mouse move Pac-Man; verify ghosts move autonomously, pellet consumption increments the score, power pellets enable ghost-eating, life loss and game-over conditions work correctly.

**Acceptance Scenarios**:

1. **Given** the game page is loaded, **When** the start screen renders, **Then** it displays the current high score, a "Press anywhere to start" prompt, and control instructions (mouse, arrow keys, WASD).
2. **Given** the start screen is displayed, **When** the player clicks anywhere or presses any key, **Then** the game begins and the maze is rendered.
3. **Given** the game is running, **When** the player presses an arrow key or WASD key, **Then** Pac-Man moves in the corresponding direction within the maze walls.
4. **Given** Pac-Man occupies the same cell as a regular pellet, **When** the frame updates, **Then** the pellet is consumed and the score increases by 10 points.
5. **Given** Pac-Man has consumed a power pellet, **When** Pac-Man collides with a ghost within the power-up window, **Then** the ghost is eaten, a bonus score is awarded, and the ghost returns to the ghost house.
6. **Given** Pac-Man collides with a ghost in normal mode, **When** the collision occurs, **Then** one life is deducted, Pac-Man respawns, and ghosts reset.
7. **Given** all lives are lost, **When** the last life is deducted, **Then** a "Game Over" screen is displayed with the final score.
8. **Given** all pellets on the current level are consumed, **When** the last pellet is eaten, **Then** the next level loads with increased difficulty (faster ghosts).

---

### User Story 2 – Persist and View High Scores (Priority: P2)

After the game ends the player can enter a short name (up to 10 characters). The score, name, and date are saved to a persistent database. A high-score leaderboard is visible from the main menu, showing the top 10 scores in descending order.

**Why this priority**: Leaderboards add replayability and demonstrate the full-stack nature of the application (frontend → API → database), validating the Radius-managed data layer.

**Independent Test**: Complete a game, submit a name, and reload the page. Verify the score appears on the leaderboard and survives a pod restart.

**Acceptance Scenarios**:

1. **Given** the game-over screen is displayed, **When** the player enters a name and submits, **Then** the score is persisted and a confirmation is shown.
2. **Given** scores exist in the database, **When** the player navigates to the leaderboard, **Then** the top 10 scores are displayed in descending order with name, score, and date.
3. **Given** the backend pod is restarted, **When** the leaderboard is loaded, **Then** previously saved scores are still present (data survives pod lifecycle).

---

### User Story 3 – Deploy the Entire Application with a Single Script (Priority: P3)

A platform engineer clones the repository, runs a setup script to create a local Kubernetes cluster and install Radius, and then runs a deploy script to stand up the entire Pac-Man application (frontend container, backend API container, database) using `rad deploy`. All infrastructure is defined as Radius resources with custom resource types and Radius Recipes.

**Why this priority**: The deployment experience demonstrates the Radius-first constitution principle and makes the project usable by others. Without it the game is just local code.

**Independent Test**: On a fresh macOS machine with Docker installed, run the setup and deploy scripts end-to-end. Verify Radius is installed, the Kubernetes cluster is running, all Radius resources report healthy, and the game is accessible at the expected URL.

**Acceptance Scenarios**:

1. **Given** Docker is running on a macOS machine, **When** the operator runs `./scripts/setup-cluster.sh`, **Then** an AKS cluster is created (or a local k3d cluster for development) and kubectl context is set.
2. **Given** a Kubernetes cluster exists, **When** the operator runs `./scripts/setup-radius.sh`, **Then** Radius is installed in the cluster, custom resource types are registered, and Recipes are configured in the Radius Environment.
3. **Given** Radius is installed and configured, **When** the operator runs `./scripts/deploy.sh`, **Then** `rad deploy` provisions all application resources (containers, database) and the game is reachable at the service URL within 5 minutes.
4. **Given** the application is deployed, **When** the operator runs `rad resource list`, **Then** all resources (frontend container, backend container, database) are shown as provisioned and healthy.

---

### User Story 4 – Tear Down the Environment Cleanly (Priority: P4)

The operator runs a teardown script that deletes the Radius application, removes Radius from the cluster, and optionally destroys the local cluster. No orphaned resources remain.

**Why this priority**: Clean teardown rounds out the operator experience and prevents resource leaks during development.

**Independent Test**: After a successful deploy, run the teardown script. Verify `rad resource list` returns empty, the namespace is gone, and (if cluster deletion is selected) the cluster no longer appears in `docker ps`.

**Acceptance Scenarios**:

1. **Given** the application is deployed, **When** the operator runs `./scripts/teardown.sh`, **Then** the Radius application and all its resources are deleted.
2. **Given** the operator passes a `--delete-cluster` flag, **When** teardown completes, **Then** the local Kubernetes cluster is also removed.

---

### Edge Cases

- What happens when the database is unreachable during score submission? The backend must return a user-friendly error and the game must continue to be playable (graceful degradation).
- What happens when a player submits an empty or whitespace-only name? The system must reject it with a validation message and re-prompt.
- What happens when the Radius environment already exists and the setup script is run again? The script must be idempotent — detect existing resources and skip or update rather than fail.
- What happens when the player presses two arrow keys simultaneously? The game should honor the most recently pressed key.
- What happens when the browser tab loses focus during gameplay? The game should pause and resume when focus returns.
- What happens when the deploy script is run without Radius installed? The script must detect the missing prerequisite and print a clear remediation message.

## Out of Scope

The following are explicitly excluded from this feature and MUST NOT be implemented:

- **Multiplayer**: No networked or local multiplayer modes.
- **Mobile-native app**: No iOS or Android native builds; the game is browser-only.
- **Sound effects / audio**: No sound; architecture should not prevent future addition.
- **User authentication / accounts**: The leaderboard is anonymous; no login or user profiles.

## Requirements *(mandatory)*

### Functional Requirements

**Gameplay**

- **FR-001**: The system MUST render a Pac-Man maze faithful to the original 1980 arcade layout, including walls, pellets, power pellets, ghost house, and tunnels.
- **FR-002**: The system MUST accept arrow-key input (↑ ↓ ← →), WASD keys, and mouse movement on macOS to control Pac-Man's direction.
- **FR-003**: The system MUST implement four ghosts (Blinky, Pinky, Inky, Clyde) with distinct chase, scatter, and frightened behaviors matching the original game's AI patterns.
- **FR-004**: The system MUST track and display the player's current score, remaining lives, and current level during gameplay.
- **FR-005**: The system MUST increase game difficulty on each subsequent level. Ghost speed MUST increase by 5% per level (capped at 2× base speed). Power pellet frightened duration MUST decrease by 1 second per level (minimum 3 seconds).
- **FR-006**: The system MUST render all visual assets (sprites, maze, fonts) in the original Pac-Man arcade style (yellow Pac-Man, colored ghosts, blue maze walls, black background).
- **FR-007**: The game MUST target a consistent 60 frames-per-second rendering loop.
- **FR-007a**: The game MUST display a start screen before gameplay begins, showing the current high score, a "Press anywhere to start" prompt, and control instructions (mouse, arrow keys, WASD) — styled to match the original Pac-Man arcade start screen.

**High-Score Service**

- **FR-008**: The system MUST expose a backend API for submitting scores (name, score, date) and retrieving the top-10 leaderboard.
- **FR-009**: The system MUST validate that submitted names are 1–10 non-empty printable characters.
- **FR-010**: The system MUST persist scores to a database that survives container restarts.
- **FR-011**: The system MUST sanitize all user input on the backend to prevent injection attacks.

**Deployment & Infrastructure**

- **FR-012**: All application containers MUST be defined as custom Radius resource types (following the `Radius.Compute/` and `Radius.Data/` namespace patterns from `resource-types-contrib`).
- **FR-012a**: All deployment MUST happen through Radius commands (`rad deploy`, `rad resource`, `rad recipe`). `kubectl` is only permitted for diagnostics and debugging (e.g., `kubectl get pods`, `kubectl logs`). No application resources may be created via `kubectl apply`, `kubectl create`, or Helm install.
- **FR-013**: The database MUST be provisioned via a Radius Recipe with a custom resource type definition.
- **FR-014**: The repository MUST include a `scripts/setup-cluster.sh` that creates or connects to a Kubernetes cluster (AKS for production/staging, k3d for local development).
- **FR-015**: The repository MUST include a `scripts/setup-radius.sh` that installs Radius, registers custom resource types, and configures Recipes in the Radius Environment.
- **FR-016**: The repository MUST include a `scripts/deploy.sh` that runs `rad deploy` to provision the full application.
- **FR-017**: The repository MUST include a `scripts/teardown.sh` that cleanly removes all Radius resources and optionally the cluster.
- **FR-017a**: The repository MUST include a `scripts/build.sh` that builds all container images (frontend and backend) and loads them into the cluster's image registry.
- **FR-018**: All scripts MUST be idempotent — safe to run multiple times without producing errors or duplicate resources.
- **FR-019**: Radius Application definitions MUST be authored in Bicep and stored under an `infra/` directory.
- **FR-019a**: Radius Recipes MUST provision all backing services (database, etc.) as Kubernetes-hosted workloads (pods/StatefulSets). No Azure managed services (e.g., Azure Database for PostgreSQL) are used; only the AKS cluster itself is an Azure resource.
- **FR-020**: Custom resource type YAML definitions MUST be stored under an `infra/resource-types/` directory, following the structure from `radius-project/resource-types-contrib`.

**Security**

- **FR-021**: Container images MUST use a minimal, non-root base image (e.g., distroless or Alpine with a non-root user). The frontend MUST use an Nginx-based image serving pre-built static assets.
- **FR-022**: No secrets or credentials MUST be baked into container images; all secrets MUST be injected via Radius Connections or Kubernetes Secrets.
- **FR-023**: The backend API MUST set HTTP security headers (Content-Security-Policy, X-Content-Type-Options, X-Frame-Options, Strict-Transport-Security).
- **FR-024**: The backend API MUST rate-limit the score-submission endpoint to prevent abuse (reasonable default: 10 requests per minute per client IP).
- **FR-025**: All dependencies MUST be pinned to specific versions to ensure reproducible builds.

**Observability**

- **FR-026**: The backend API container MUST expose `/healthz` and `/readyz` endpoints for Kubernetes liveness and readiness probes.
- **FR-027**: The backend API MUST emit structured JSON logs for all requests and errors (no unstructured log lines).

### Key Entities

- **Game Session**: A single play-through from start to game-over. Attributes: session start time, final score, level reached, lives used.
- **High Score Entry**: A submitted leaderboard record. Attributes: player name (1–10 chars), score (positive integer), date submitted.
- **Radius Application**: The top-level Radius resource encapsulating all game components (frontend container, backend container, database connection).
- **Custom Resource Type**: A YAML definition describing the schema of a Radius-managed resource (e.g., `Radius.Compute/containers`, `Radius.Data/postgreSqlDatabases`). Each type has a matching Recipe that implements provisioning.
- **Radius Recipe**: Platform-specific Infrastructure-as-Code (Bicep) that provisions the concrete infrastructure for a given resource type on Kubernetes.

## Assumptions

- The target Kubernetes cluster is **AKS (Azure Kubernetes Service)**. Scripts MUST support creating or connecting to an AKS cluster. AKS is used purely as the compute platform; no Azure managed services (databases, caches, etc.) are used.
- Radius Recipes MUST provision all backing services as Kubernetes-hosted workloads (pods/StatefulSets) running within the cluster. The same Recipes work on both local k3d/kind clusters and AKS.
- The implementation language for the game frontend is **TypeScript** with an HTML5 Canvas renderer — chosen for broad browser compatibility, rich ecosystem, and natural fit for a web-delivered game on Kubernetes. The frontend is compiled to static JS/HTML/CSS at build time and served by an **Nginx** container (no Node.js runtime in production).
- The backend score API will use **Go** — chosen for its small container image size, fast startup, low memory footprint, strong standard library for HTTP servers, and alignment with the cloud-native ecosystem (Radius itself is written in Go).
- The database for high scores will be **PostgreSQL**, provisioned via a custom Radius resource type and Kubernetes-based Recipe (matching the `Data/postgreSqlDatabases` pattern in `resource-types-contrib`).
- Scripts assume macOS with Homebrew available for installing prerequisites (Docker, Azure CLI, k3d, rad CLI).
- The game does not require user authentication or accounts; the leaderboard is open and anonymous.
- Sound effects are a nice-to-have — they are not required for the MVP but the architecture should not prevent their addition later.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A player can load the game in a browser within 3 seconds of navigating to the URL and begin playing immediately.
- **SC-002**: Arrow-key input is reflected in Pac-Man's movement with less than 100 ms of perceived latency.
- **SC-003**: The game maintains a stable 60 FPS during normal gameplay on a modern browser (Chrome or Safari on macOS).
- **SC-004**: A score submitted after game-over appears on the leaderboard within 2 seconds and persists across pod restarts.
- **SC-005**: The full environment (cluster + Radius + application) can be deployed from scratch on a macOS machine in under 10 minutes by running three scripts in sequence.
- **SC-006**: `rad resource list` shows all application resources (frontend, backend, database) as provisioned and healthy after deployment.
- **SC-007**: Teardown script removes all Radius resources and the cluster with zero orphaned containers or volumes.
- **SC-008**: Container images are each under 100 MB in size.
- **SC-009**: The backend API handles at least 50 concurrent leaderboard requests without error or degradation.

## Clarifications

### Session 2026-02-20

- Q: What level of observability should be required for the MVP? → A: Health endpoints (`/healthz`, `/readyz`) + structured JSON logging only; defer Prometheus metrics and OpenTelemetry tracing to a future iteration.
- Q: What should be explicitly out of scope? → A: Multiplayer, mobile-native app, sound effects, and user authentication/accounts are all out of scope. The target cluster is AKS, but Radius Recipes must support both local (k3d/kind) and cloud (AKS) deployments.
- Q: What should the start screen look like? → A: Match the original Pac-Man arcade start screen — display current high score at top, "Press anywhere to start" prompt, and control instructions (use your mouse, arrow keys, or WASD to move).
- Q: How should PostgreSQL be provisioned on AKS? → A: Kubernetes-hosted pod only. No Azure managed services. AKS is purely the compute platform; all backing services run as pods inside the cluster.
- Q: How should the frontend be served? → A: Static build served by an Nginx container. TypeScript compiled to static JS/HTML/CSS at build time; Nginx serves the files. No Node.js runtime in production.
