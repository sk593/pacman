# Research Report: Cloud-Native Pac-Man on Kubernetes with Radius

**Date**: 2026-02-20  
**Spec**: `specs/001-k8s-pacman-radius/spec.md`  
**Status**: Complete

---

## Topic 1: Radius Custom Resource Type Definitions

### Decision

Use the `radius-project/resource-types-contrib` YAML definition format to define two custom resource types: `Radius.Compute/containers` (reuse the upstream definition) and `Radius.Data/postgreSqlDatabases` (reuse the upstream definition). Reference these at API version `2025-08-01-preview`.

### Rationale

The resource type YAML format is the canonical way to define custom types in Radius. Both container and PostgreSQL definitions already exist upstream and can be used directly via `rad resource-type create -f <file>.yaml`. The YAML structure is well-defined and documented.

**Resource Type YAML Structure** (from `resource-types-contrib`):

```yaml
namespace: Radius.<Category>          # e.g., Radius.Compute, Radius.Data
types:
  <resourceName>:                     # e.g., containers, postgreSqlDatabases
    description: |                    # Multi-line description with embedded Bicep examples
      ...
    apiVersions:
      '2025-08-01-preview':           # API version string
        schema:
          type: object
          properties:
            environment:              # (Required) Radius Environment ID
              type: string
            application:              # (Required/Optional) Radius Application ID
              type: string
            # ... resource-specific properties with type, description, enum, etc.
          required: [environment, ...]
```

**Key fields in each resource type YAML**:
- `namespace` — Top-level namespace using `Radius.<Category>` convention (e.g., `Radius.Compute`, `Radius.Data`)
- `types.<name>.description` — Extended documentation with inline Bicep examples, accessible via `rad resource-type show`
- `types.<name>.apiVersions.<version>.schema` — JSON Schema-like object defining all properties, their types, descriptions, enums, defaults, and `readOnly` markers
- Required properties are listed in a `required` array at the schema level

**Namespace convention**: `Radius.Core` for applications, `Radius.Compute` for containers, `Radius.Data` for data resources. The full resource type identifier is `<Namespace>/<typeName>` (e.g., `Radius.Compute/containers`, `Radius.Data/postgreSqlDatabases`).

**Container resource type** (`Radius.Compute/containers`):
- Required properties: `environment`, `application`, `containers`
- Supports: `connections`, `containers` (with image, ports, env, volumeMounts, probes, resources), `volumes`, `replicas`, `autoScaling`, `extensions` (daprSidecar), `platformOptions`, `restartPolicy`
- Analogous to a Kubernetes Deployment; creates a Service when ports are specified

**PostgreSQL resource type** (`Radius.Data/postgreSqlDatabases`):
- Required properties: `environment`
- Input properties: `size` (enum: S, M, L), `application`
- Output properties (readOnly, set by recipe): `host`, `port`, `database`, `username`, `password`
- Connections auto-inject env vars as `CONNECTION_<NAME>_<PROPERTY>` (e.g., `CONNECTION_POSTGRESQL_HOST`)

### Alternatives Considered

| Alternative | Why Rejected |
|---|---|
| Define entirely custom resource types from scratch | Upstream definitions are comprehensive and battle-tested; no need to reinvent |
| Use `Applications.Datastores/sqlDatabases` (built-in) | Built-in types use the legacy `Applications.*` namespace; the new `Radius.*` namespace is the recommended convention |
| Use Extender resources instead of custom types | Extenders lack typed schemas and connection auto-injection |

---

## Topic 2: Radius Recipes for Kubernetes

### Decision

Write Bicep Recipes for the Kubernetes platform only. Use the `extension kubernetes` pattern with `param context object` to receive Radius recipe context. The container recipe creates Kubernetes Deployments + Services; the PostgreSQL recipe creates a PostgreSQL Deployment + Service with credentials.

### Rationale

**Bicep Recipe structure** (from upstream examples):

```bicep
@description('Radius context object passed into the recipe.')
param context object

extension kubernetes with {
  kubeConfig: ''
  namespace: context.runtime.kubernetes.namespace
} as kubernetes

// Create Kubernetes resources using the kubernetes extension
resource deployment 'apps/Deployment@v1' = { ... }
resource svc 'core/Service@v1' = { ... }

output result object = {
  resources: [
    '/planes/kubernetes/local/namespaces/${svc.metadata.namespace}/providers/core/Service/${svc.metadata.name}'
    '/planes/kubernetes/local/namespaces/${deployment.metadata.namespace}/providers/apps/Deployment/${deployment.metadata.name}'
  ]
  values: { host: '...', port: ... }
  secrets: { password: '...' }
}
```

**Key patterns observed in upstream Recipes**:

1. **`param context object`** — Every recipe receives a Radius context object containing `context.resource.name`, `context.resource.id`, `context.resource.properties`, `context.runtime.kubernetes.namespace`, `context.application.name`
2. **`extension kubernetes`** — Declares the Kubernetes provider with `kubeConfig: ''` (uses in-cluster config) and specifies the target namespace
3. **`output result object`** — Must return `resources` (array of Radius resource plane paths), optional `values` (non-secret outputs), and optional `secrets` (secret outputs like passwords)
4. **Resource plane paths** follow format: `/planes/kubernetes/local/namespaces/<ns>/providers/<apiGroup>/<Kind>/<name>`

**PostgreSQL Recipe specifics** (from `kubernetes-postgresql.bicep`):
- Accepts additional params: `database`, `user`, `password`, `tag` with defaults derived from `context`
- Creates a PostgreSQL Deployment using `postgres:16-alpine` image
- Creates a ClusterIP Service
- Size-based memory allocation via lookup table (S→512Mi, M→1Gi, L→2Gi)
- Labels pods with `radapp.io/application` for `rad run` log discovery
- Outputs `host` (FQDN: `<svc>.<ns>.svc.cluster.local`), `port`, `database`, `username` as values; `password` as secret

**Container Recipe specifics** (from `kubernetes-containers.bicep`):
- Highly generic: handles multiple containers, init containers, volume mounts, probes, env vars, Dapr sidecars, HPA
- Automatically injects `CONNECTION_<NAME>_<PROP>` environment variables from connected resources
- Handles secrets connections via `envFrom.secretRef`
- Creates one Deployment + one Service per container with ports + optional HPA

### Alternatives Considered

| Alternative | Why Rejected |
|---|---|
| Terraform recipes | Bicep is first-class in Radius, simpler for Kubernetes-only deployment, no Terraform provider dependency |
| Helm chart wrapping | Radius Recipes are the idiomatic approach; Helm adds an unnecessary abstraction layer |
| Direct Kubernetes YAML (no Recipes) | Loses the Radius Recipe abstraction, making it harder to swap infrastructure later |

---

## Topic 3: Radius Application Bicep Definition

### Decision

Define the application in a single `app.bicep` file using `extension radius` + `extension radiusResources`, with an `Applications.Core/applications` resource, `Radius.Compute/containers` resources for frontend and backend, `Radius.Data/postgreSqlDatabases` for the database, and `connections` to wire them together.

### Rationale

**Application Bicep pattern** (from Radius tutorials and docs):

```bicep
extension radius                    // Built-in Radius types (Applications.Core/*)
extension radiusResources           // Custom resource types (Radius.Compute/*, Radius.Data/*)

@description('Set automatically by rad CLI')
param environment string

// Application
resource app 'Applications.Core/applications@2023-10-01-preview' = {
  name: 'pacman'
  properties: {
    environment: environment
  }
}

// Database (custom resource type with Recipe)
resource db 'Radius.Data/postgreSqlDatabases@2025-08-01-preview' = {
  name: 'pacmandb'
  properties: {
    environment: environment
    application: app.id
    size: 'S'
  }
}

// Backend container (custom resource type with Recipe)
resource backend 'Radius.Compute/containers@2025-08-01-preview' = {
  name: 'backend'
  properties: {
    environment: environment
    application: app.id
    containers: {
      api: {
        image: '<registry>/pacman-api:latest'
        ports: {
          http: { containerPort: 8080 }
        }
      }
    }
    connections: {
      db: { source: db.id }         // Auto-injects CONNECTION_DB_* env vars
    }
  }
}

// Frontend container
resource frontend 'Radius.Compute/containers@2025-08-01-preview' = {
  name: 'frontend'
  properties: {
    environment: environment
    application: app.id
    containers: {
      web: {
        image: '<registry>/pacman-frontend:latest'
        ports: {
          http: { containerPort: 80 }
        }
      }
    }
    connections: {
      api: { source: 'http://backend-api:8080' }  // Service networking
    }
  }
}
```

**Key patterns**:
- `extension radius` — imports built-in types like `Applications.Core/applications`
- `extension radiusResources` — imports custom types registered via `rad resource-type create` (e.g., `Radius.Compute/containers`, `Radius.Data/postgreSqlDatabases`)
- **Connections**: `connections: { <name>: { source: <resource>.id } }` — auto-injects `CONNECTION_<NAME>_<PROPERTY>` environment variables
- **Network connections**: `source: 'http://<service-name>:<port>'` for container-to-container HTTP routing
- **Recipe resolution**: When a custom resource type has a registered Recipe in the environment, Radius automatically executes the Recipe when the resource is deployed
- **Probes**: Supported via `readinessProbe` and `livenessProbe` on the container definition (httpGet, tcp, exec kinds)
- **Runtimes**: Optional `runtimes.kubernetes.base` for raw YAML passthrough, `runtimes.kubernetes.pod` for PodSpec patching

### Alternatives Considered

| Alternative | Why Rejected |
|---|---|
| Separate Bicep modules per resource | Single file is simpler for an application with 3 resources; modularity adds overhead without benefit at this scale |
| Use `Applications.Core/containers` (legacy) | New `Radius.Compute/containers` with Recipes is the current recommended pattern; demonstrates the custom resource type flow |
| Multiple `app.bicep` files for dev/prod | A single `app.bicep` with environment parameters is sufficient; environment-specific config belongs in the Radius Environment and Recipe registration |

---

## Topic 4: Go Backend Best Practices for Score API

### Decision

Use Go 1.22+ with `net/http` (stdlib ServeMux), `log/slog` for structured JSON logging, `jackc/pgx/v5` for PostgreSQL, stdlib-based middleware for rate limiting and security headers, and `gcr.io/distroless/static-debian12:nonroot` as the container base image.

### Rationale

**Go HTTP server with `slog`**:
- Go 1.22+ `net/http.ServeMux` supports method-based routing (`mux.HandleFunc("GET /scores", ...)`) eliminating the need for a router library
- `log/slog` (stdlib since Go 1.21) provides structured, leveled logging with JSON output via `slog.NewJSONHandler(os.Stdout, &slog.HandlerOptions{Level: slog.LevelInfo})`
- Request ID middleware adds trace context: `slog.With("request_id", requestID)`

```go
logger := slog.New(slog.NewJSONHandler(os.Stdout, &slog.HandlerOptions{
    Level: slog.LevelInfo,
}))
slog.SetDefault(logger)
```

**Health check endpoints** (`/healthz`, `/readyz`):
- `/healthz` (liveness) — returns `200 OK` with `{"status":"ok"}` if the process is running; should NOT check dependencies (K8s will restart on failure)
- `/readyz` (readiness) — returns `200 OK` only when the database connection pool is verified (`pool.Ping(ctx)`); returns `503` otherwise; K8s removes from Service endpoints when failing
- Both endpoints should bypass authentication and rate limiting middleware

```go
mux.HandleFunc("GET /healthz", func(w http.ResponseWriter, r *http.Request) {
    w.Header().Set("Content-Type", "application/json")
    w.Write([]byte(`{"status":"ok"}`))
})
mux.HandleFunc("GET /readyz", func(w http.ResponseWriter, r *http.Request) {
    if err := pool.Ping(r.Context()); err != nil {
        w.WriteHeader(http.StatusServiceUnavailable)
        json.NewEncoder(w).Encode(map[string]string{"status":"not ready"})
        return
    }
    json.NewEncoder(w).Encode(map[string]string{"status":"ok"})
})
```

**PostgreSQL with `pgx`**:
- `jackc/pgx/v5/pgxpool` for connection pooling (preferred over `database/sql` for PostgreSQL-specific features and performance)
- Connection string from environment variables injected by Radius connections: `CONNECTION_DB_HOST`, `CONNECTION_DB_PORT`, `CONNECTION_DB_DATABASE`, `CONNECTION_DB_USERNAME`, `CONNECTION_DB_PASSWORD`
- Use `pgxpool.New(ctx, connString)` with retry logic on startup
- Schema migration at startup using embedded SQL files (`embed` package)

```go
connStr := fmt.Sprintf("postgres://%s:%s@%s:%s/%s?sslmode=disable",
    os.Getenv("CONNECTION_DB_USERNAME"),
    os.Getenv("CONNECTION_DB_PASSWORD"),
    os.Getenv("CONNECTION_DB_HOST"),
    os.Getenv("CONNECTION_DB_PORT"),
    os.Getenv("CONNECTION_DB_DATABASE"),
)
pool, err := pgxpool.New(ctx, connStr)
```

**Rate limiting middleware**:
- Use `golang.org/x/time/rate` (stdlib-adjacent) for a token bucket rate limiter
- Per-IP limiting using `sync.Map` to store `*rate.Limiter` per client IP
- Default: 10 requests/minute per client IP (matching FR-024); implemented as a token bucket refilling at ~1 token per 6 seconds
- Return `429 Too Many Requests` with `Retry-After` header

**Security headers middleware**:
- `X-Content-Type-Options: nosniff`
- `X-Frame-Options: DENY`
- `X-XSS-Protection: 0` (modern browsers use CSP instead)
- `Content-Security-Policy: default-src 'self'`
- `Strict-Transport-Security: max-age=31536000; includeSubDomains` (when behind TLS)
- `Referrer-Policy: strict-origin-when-cross-origin`

**Distroless container image**:

```dockerfile
FROM golang:1.22-bookworm AS builder
WORKDIR /app
COPY go.mod go.sum ./
RUN go mod download
COPY . .
RUN CGO_ENABLED=0 GOOS=linux go build -ldflags="-s -w" -o /server ./cmd/server

FROM gcr.io/distroless/static-debian12:nonroot
COPY --from=builder /server /server
EXPOSE 8080
USER nonroot:nonroot
ENTRYPOINT ["/server"]
```

- `gcr.io/distroless/static-debian12:nonroot` has no shell, no package manager — minimal attack surface
- `nonroot` tag runs as UID 65534 by default
- `CGO_ENABLED=0` for static binary (no libc dependency)
- `-ldflags="-s -w"` strips debug info for smaller binary

### Alternatives Considered

| Alternative | Why Rejected |
|---|---|
| Gin/Echo/Chi router | Go 1.22 stdlib ServeMux now supports method routing; no external dependency needed for this API surface |
| `database/sql` + `lib/pq` | `pgx` is the modern standard for PostgreSQL in Go — better performance, native types, connection pooling |
| `zerolog` or `zap` for logging | `slog` is stdlib since Go 1.21, zero dependency, sufficient for structured JSON logging |
| Alpine-based image | Distroless is smaller and has no shell/package manager — better security posture; Alpine still has `sh` and `apk` |
| External rate limiter (Redis-based) | Overkill for a single-pod game API; `x/time/rate` per-IP is sufficient |

---

## Topic 5: TypeScript HTML5 Canvas Pac-Man Game

### Decision

Use TypeScript with Vite for bundling, HTML5 Canvas with `requestAnimationFrame` for the 60fps game loop, classic ghost AI algorithms, combined arrow/WASD/mouse input handling, and a multi-stage Docker build (Node → Nginx).

### Rationale

**TypeScript + Vite project setup**:
- Vite offers fast dev server (HMR), tree-shaking, and outputs static files (`dist/`) ideal for Nginx serving
- `tsconfig.json`: `target: "ES2022"`, `module: "ESNext"`, `strict: true`
- Output: pure static HTML + JS + CSS bundle, no server-side runtime needed

```json
{
  "scripts": {
    "dev": "vite",
    "build": "tsc && vite build",
    "preview": "vite preview"
  }
}
```

**HTML5 Canvas game loop at 60fps**:
- Use `requestAnimationFrame` for vsync-aligned rendering
- Delta-time accumulator pattern for fixed-step physics (16.67ms per tick) with variable rendering:

```typescript
const TICK_RATE = 1000 / 60;
let lastTime = 0;
let accumulator = 0;

function gameLoop(timestamp: number): void {
  const delta = timestamp - lastTime;
  lastTime = timestamp;
  accumulator += delta;

  while (accumulator >= TICK_RATE) {
    update(TICK_RATE);    // Fixed physics step
    accumulator -= TICK_RATE;
  }

  render();               // Render at display refresh rate
  requestAnimationFrame(gameLoop);
}
requestAnimationFrame(gameLoop);
```

**Ghost AI patterns** (faithful to original Pac-Man):
- Each ghost targets a tile and uses the same pathfinding: at each intersection, choose the direction whose next tile is closest (Euclidean distance) to the target tile; never reverse unless mode-switching
- **Blinky (Red)** — Chase: targets Pac-Man's current tile directly. Most aggressive.
- **Pinky (Pink)** — Ambush: targets 4 tiles ahead of Pac-Man's current direction. Tries to cut off Pac-Man.
- **Inky (Cyan)** — Unpredictable: target = 2× vector from Blinky's position to 2 tiles ahead of Pac-Man. Creates flanking behavior dependent on Blinky's position.
- **Clyde (Orange)** — Shy: when >8 tiles from Pac-Man, targets Pac-Man directly (like Blinky); when ≤8 tiles away, retreats to scatter corner (bottom-left).
- **Scatter mode**: Each ghost retreats to its assigned corner (Blinky→top-right, Pinky→top-left, Inky→bottom-right, Clyde→bottom-left). Alternates with Chase mode on a timer.
- **Frightened mode**: After power pellet, ghosts pick random valid directions at each intersection. Speed reduced.

```typescript
interface Ghost {
  name: 'blinky' | 'pinky' | 'inky' | 'clyde';
  mode: 'chase' | 'scatter' | 'frightened' | 'eaten';
  position: Tile;
  direction: Direction;
  getTargetTile(pacman: PacMan, blinky: Ghost): Tile;
}
```

**Input handling (arrow keys, WASD, mouse)**:
- Listen on `keydown` for arrow keys (ArrowUp/Down/Left/Right) and WASD (w/a/s/d)
- Queue the most recent directional input; apply it when Pac-Man reaches the next tile center and the target direction is not a wall
- Mouse/touch: calculate angle from Pac-Man's position to click/touch point; map to nearest cardinal direction
- Prevent default on arrow keys to avoid page scrolling

```typescript
document.addEventListener('keydown', (e: KeyboardEvent) => {
  const keyMap: Record<string, Direction> = {
    ArrowUp: 'up', ArrowDown: 'down', ArrowLeft: 'left', ArrowRight: 'right',
    w: 'up', s: 'down', a: 'left', d: 'right',
    W: 'up', S: 'down', A: 'left', D: 'right',
  };
  if (keyMap[e.key]) {
    e.preventDefault();
    nextDirection = keyMap[e.key];
  }
});

canvas.addEventListener('click', (e: MouseEvent) => {
  const dx = e.offsetX - pacman.screenX;
  const dy = e.offsetY - pacman.screenY;
  nextDirection = Math.abs(dx) > Math.abs(dy)
    ? (dx > 0 ? 'right' : 'left')
    : (dy > 0 ? 'down' : 'up');
});
```

**Multi-stage Docker build (Node → Nginx)**:

```dockerfile
# Stage 1: Build
FROM node:22-alpine AS builder
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
RUN npm run build

# Stage 2: Serve
FROM nginx:1.27-alpine
COPY --from=builder /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
USER nginx
```

- Node stage uses `npm ci` for reproducible installs, then `npm run build` (Vite outputs to `dist/`)
- Nginx stage copies only the static bundle — no Node runtime in production
- Custom `nginx.conf` to set security headers, gzip, and SPA fallback (`try_files $uri /index.html`)
- Run as non-root `nginx` user

### Alternatives Considered

| Alternative | Why Rejected |
|---|---|
| Webpack instead of Vite | Vite is faster for dev (native ESM), simpler config, and produces equivalent production bundles |
| React/Pixi.js framework | A pure Canvas game doesn't need a UI framework; direct Canvas API is more performant and simpler for a game loop |
| WebGL renderer | Pac-Man's 2D pixel art doesn't benefit from GPU acceleration; Canvas 2D is simpler and universally supported |
| Server-side rendering | Game is entirely client-side; static files served by Nginx are ideal |
| Apache httpd | Nginx is lighter-weight, more common in container deployments, and has better performance for static file serving |
| Pre-built ghost AI library | Custom AI is part of the project scope and demonstrates game logic; the algorithms are straightforward to implement |

---

## Source References

| Source | URL | Accessed |
|---|---|---|
| resource-types-contrib: containers YAML | https://github.com/radius-project/resource-types-contrib/blob/main/Compute/containers/containers.yaml | 2026-02-20 |
| resource-types-contrib: postgreSqlDatabases YAML | https://github.com/radius-project/resource-types-contrib/blob/main/Data/postgreSqlDatabases/postgreSqlDatabases.yaml | 2026-02-20 |
| resource-types-contrib: container Recipe (Bicep) | https://github.com/radius-project/resource-types-contrib/blob/main/Compute/containers/recipes/kubernetes/bicep/kubernetes-containers.bicep | 2026-02-20 |
| resource-types-contrib: PostgreSQL Recipe (Bicep) | https://github.com/radius-project/resource-types-contrib/blob/main/Data/postgreSqlDatabases/recipes/kubernetes/bicep/kubernetes-postgresql.bicep | 2026-02-20 |
| Radius docs: Container overview | https://docs.radapp.io/guides/author-apps/containers/overview/ | 2026-02-20 |
| Radius docs: Container schema | https://docs.radapp.io/reference/resource-schema/core-schema/container-schema/ | 2026-02-20 |
| Radius docs: Deploy application tutorial | https://docs.radapp.io/tutorials/deploy-application/ | 2026-02-20 |
