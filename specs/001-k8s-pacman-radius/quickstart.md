# Quickstart: Cloud-Native Pac-Man on Kubernetes with Radius

**Time**: ~10 minutes  
**Prerequisites**: macOS with Docker Desktop running, k3d installed

## 1. Clone the repository

```bash
git clone <repo-url> && cd pacman
```

## 2. Create a local Kubernetes cluster

```bash
./scripts/setup-cluster.sh
```

Creates a k3d cluster named `pacman-dev` with an integrated OCI registry (`localhost:5111` on the host, `pacman-registry:5000` in-cluster).

## 3. Install Radius and register resource types

```bash
./scripts/setup-radius.sh
```

Installs the Radius control plane, registers custom resource types (`Radius.Compute/containers`, `Radius.Data/postgreSqlDatabases`), publishes Bicep Recipes to the local registry, and registers them with the default Radius Environment.

## 4. Build container images

```bash
./scripts/build.sh
```

Builds the frontend (TypeScript → Nginx) and backend (Go) container images and pushes them to the local k3d registry.

## 5. Deploy the application

```bash
./scripts/deploy.sh
```

Runs `rad deploy infra/app.bicep` to provision:
- **frontend** — Nginx container serving the Pac-Man game (port 80)
- **backend** — Go API for high scores (port 8080)
- **scoredb** — PostgreSQL pod for score persistence

## 6. Play

```bash
# Port-forward the frontend to access the game
kubectl port-forward svc/frontend-frontend 8080:80
```

Open http://localhost:8080 in your browser. Use arrow keys, WASD, or mouse to play.

## 7. Verify resources

```bash
rad resource list --application pacman
```

Expected output: 3 resources (frontend, backend, scoredb) all showing `Provisioned`.

## 8. Tear down

```bash
./scripts/teardown.sh                  # Remove Radius app + resources
./scripts/teardown.sh --delete-cluster # Also delete the k3d cluster + registry
```

## Troubleshooting

| Symptom | Fix |
|---------|-----|
| `rad` command not found | Run `./scripts/setup-radius.sh` — it installs the rad CLI |
| Pods not starting | `kubectl get pods -n default-pacman` — check events and logs |
| Database connection refused | `kubectl logs deploy/scoredb` — verify PostgreSQL started; check `rad resource show Radius.Data/postgreSqlDatabases scoredb` |
| Frontend 502 | Backend may not be ready — check `/readyz` endpoint and pod logs |
| Registry push fails | Ensure cluster is running: `k3d cluster list` |
| Recipe registration fails | The script uses the registry's Docker network IP to bypass DNS issues on macOS |
