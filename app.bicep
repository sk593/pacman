// Cloud-Native Pac-Man on AKS with Radius
// Radius Application definition — the top-level resource that groups all components.

extension radius

@description('Set automatically by rad CLI')
param environment string

// ---------------------------------------------------------------------------
// Application
// ---------------------------------------------------------------------------
resource app 'Applications.Core/applications@2023-10-01-preview' = {
  name: 'pacman'
  properties: {
    environment: environment
  }
}
