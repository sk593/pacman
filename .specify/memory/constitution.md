<!--
  Sync Impact Report
  ──────────────────
  Version change: 1.2.0 → 1.3.0 (local registry & public push rules)
  Modified principles: N/A
  Modified sections:
    - Principle III — added local-only OCI registry rule
    - Principle IV — added recipe publishing constraints
    - Development Workflow — clarified registry usage policy
  Added sections: N/A
  Removed sections: N/A
  Templates requiring updates:
    - .specify/templates/plan-template.md ✅ no changes needed
    - .specify/templates/spec-template.md ✅ no changes needed
    - .specify/templates/tasks-template.md ✅ no changes needed
  Follow-up TODOs: none
-->

# Pac-Man Cloud-Native Constitution

## Core Principles

### I. Cloud-Native First

All application components MUST be designed to run on Kubernetes.

- Every service MUST be stateless or use external backing
  services for persistence.
- Configuration MUST be injected via environment variables or
  Kubernetes ConfigMaps/Secrets — never hard-coded.
- Components MUST expose health endpoints (`/healthz`,
  `/readyz`) so Kubernetes can manage pod lifecycle.
- Horizontal scaling MUST be the default strategy; vertical
  scaling requires explicit justification.

### II. Radius-Managed Deployments (NON-NEGOTIABLE)

ALL infrastructure and application resources MUST be deployed
and managed through [Radius](https://radapp.io/).

- Containers, databases, caches, message brokers, and any
  other backing service MUST be defined as Radius resources
  in Radius Application files.
- Direct `kubectl apply` of raw manifests or Helm charts
  outside of Radius is PROHIBITED for application workloads.
- `kubectl` MUST only be used for diagnostics and debugging
  (e.g., `kubectl get pods`, `kubectl logs`). All resource
  creation, updates, and deployment MUST go through Radius
  (`rad deploy`, `rad resource`, Recipes).
- Radius Recipes MUST be used to provision cloud or
  infrastructure-level resources (e.g., MongoDB, Redis).
- Radius Environments MUST be defined for each deployment
  target (dev, staging, production).
- Radius Connections MUST be used to wire services together,
  ensuring connection strings and credentials are injected
  automatically rather than manually configured.

### III. Container-First Architecture

Every deployable component MUST ship as an OCI-compliant
container image.

- Each service MUST have a Dockerfile (or equivalent build
  definition) in its source directory.
- Images MUST use minimal base images (e.g., distroless,
  Alpine) to reduce attack surface.
- Images MUST NOT embed secrets, credentials, or environment-
  specific configuration at build time.
- Multi-stage builds MUST be used to keep production images
  lean.
- **Local Registry Only (NON-NEGOTIABLE)**: All OCI artifacts
  (container images, Radius Recipes, Bicep extensions) MUST
  be published to a LOCAL container registry (e.g., k3d
  registry) during development. NEVER push to a public or
  remote registry (ttl.sh, Docker Hub, GHCR, etc.) without
  explicit user approval. This applies to all automated
  scripts and agent-driven workflows.

### IV. Infrastructure as Code

All infrastructure MUST be declared as code and version-
controlled alongside application source.

- Radius Application definitions (Bicep files) MUST live in
  the repository under a dedicated `deploy/` or `infra/`
  directory.
- Radius Recipes for backing services MUST be version-
  controlled and reproducible.
- Radius Recipes MUST be published to a LOCAL OCI registry
  for development. Scripts MUST NOT publish to remote or
  public registries without explicit operator consent.
- Manual infrastructure changes (ClickOps) are PROHIBITED;
  all changes MUST flow through code review and CI/CD.
- Environment-specific overrides MUST be parameterized, not
  duplicated across files.

### V. Observability

Every service MUST be observable in production from day one.

- Structured JSON logging MUST be used; unstructured log
  lines are PROHIBITED.
- Kubernetes liveness and readiness probes MUST be configured
  for every container.
- Application metrics SHOULD be exposed in Prometheus format
  at a `/metrics` endpoint.
- Distributed tracing SHOULD be instrumented using
  OpenTelemetry where inter-service calls exist.

### VI. Simplicity & Portability

Start simple and keep the architecture portable across any
Kubernetes distribution.

- YAGNI: do not add components, services, or abstractions
  until a concrete requirement demands them.
- Kubernetes-standard APIs MUST be preferred over vendor-
  specific extensions; any vendor lock-in requires explicit
  justification.
- Radius abstractions MUST be leveraged to keep application
  definitions cloud-agnostic, avoiding direct references to
  provider-specific resource types unless absolutely
  necessary.

## Technology Stack & Constraints

- **Runtime Platform**: Kubernetes (any conformant
  distribution)
- **Deployment Orchestrator**: Radius (radapp.io)
- **Container Runtime**: OCI-compliant (containerd, CRI-O)
- **Game Frontend**: TypeScript web application compiled to
  static assets (HTML/JS/CSS), served by Nginx container
- **Backend / Score Service**: Go API container
- **Database**: PostgreSQL — provisioned as a Radius Recipe
  (Kubernetes-hosted pod; portable across local and cloud
  clusters)
- **Infrastructure Language**: Bicep (Radius Application
  definitions)
- **CI/CD**: GitHub Actions (or equivalent); pipelines MUST
  invoke `rad deploy` rather than raw `kubectl`
- **Image Registry**: Local OCI-compliant registry for
  development (k3d registry); remote registries (GHCR, ACR)
  only for CI/CD with explicit approval

## Development Workflow

- **Branching**: Feature branches off `main`; PRs require at
  least one review before merge.
- **Local Development**: Use `rad run` or `rad deploy` for
  local iteration against a local Kubernetes cluster (e.g.,
  k3d, kind). `kubectl` is permitted for diagnostics and
  debugging only — never for deploying or creating
  application resources.
- **Quality Gates**:
  - Dockerfile builds MUST succeed.
  - `rad bicep build` MUST produce no errors.
  - Linting and unit tests MUST pass before merge.
  - Integration tests SHOULD run against a Radius-managed
    ephemeral environment.
- **Deployment Pipeline**: CI merges to `main` trigger
  `rad deploy` to the staging environment; production
  promotion is manual or gated.

## Governance

This constitution is the authoritative source of project-wide
technical policy. All other documents, templates, and agent
guidance MUST align with it.

- **Amendments**: Any change to this constitution MUST be
  submitted as a PR with a clear rationale. The Sync Impact
  Report (HTML comment at the top) MUST be updated.
- **Versioning**: MAJOR.MINOR.PATCH semantic versioning.
  MAJOR for principle removals/redefinitions, MINOR for new
  principles or material expansion, PATCH for wording and
  typo fixes.
- **Compliance**: All PRs and code reviews MUST verify that
  changes do not violate the principles above. Violations
  MUST be flagged and resolved before merge.
- **Complexity Justification**: Any deviation from Simplicity
  & Portability (Principle VI) MUST include written
  justification in the PR description.

**Version**: 1.3.0 | **Ratified**: 2026-02-20 | **Last Amended**: 2026-02-24
