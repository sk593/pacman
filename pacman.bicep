// Pac-Man resources backed by Azure managed services
//
// Custom Radius resource types:
//   - Radius.Compute/containers            — AKS container deployment
//   - Radius.Compute/functions             — AKS worker deployment
//   - Radius.Data/postgreSqlDatabases      — Azure Database for PostgreSQL Flexible Server
//   - Radius.Data/redisCaches              — Azure Cache for Redis
//   - Radius.AI/models                     — Azure OpenAI
//   - Radius.Storage/blobStores            — Azure Blob Storage

extension radius
extension containers
extension postgreSqlDatabases
extension redisCaches
extension models
extension blobStores
extension functions

@description('Set automatically by rad CLI')
param environment string

@description('The ID of the Radius application to associate resources with.')
param application string

@description('Frontend container image')
param frontendImage string = 'pacman-frontend:latest'

@description('Backend container image')
param backendImage string = 'pacman-api:latest'

@description('Score processor function image')
param scoreProcessorImage string = 'pacman-score-processor:latest'

// ---------------------------------------------------------------------------
// PostgreSQL Database (Azure Database for PostgreSQL Flexible Server via Recipe)
// ---------------------------------------------------------------------------
resource scoredb 'Radius.Data/postgreSqlDatabases@2025-08-01-preview' = {
  name: 'scoredb'
  properties: {
    environment: environment
    application: application
    size: 'S'
  }
}

// ---------------------------------------------------------------------------
// Redis Cache + Message Queue (Azure Cache for Redis via Recipe)
// ---------------------------------------------------------------------------
resource cache 'Radius.Data/redisCaches@2025-08-01-preview' = {
  name: 'cache'
  properties: {
    environment: environment
    application: application
  }
}

// ---------------------------------------------------------------------------
// AI Model — theme generation (Azure OpenAI via Recipe)
// ---------------------------------------------------------------------------
resource aimodel 'Radius.AI/models@2025-08-01-preview' = {
  name: 'aimodel'
  properties: {
    environment: environment
    application: application
    model: 'gpt-4o-mini'
  }
}

// ---------------------------------------------------------------------------
// Blob Storage — theme assets (Azure Blob Storage via Recipe)
// ---------------------------------------------------------------------------
resource themes 'Radius.Storage/blobStores@2025-08-01-preview' = {
  name: 'themes'
  properties: {
    environment: environment
    application: application
    bucket: 'pacman-themes'
  }
}

// ---------------------------------------------------------------------------
// Backend — Go Score API + Theme API
// ---------------------------------------------------------------------------
resource backend 'Radius.Compute/containers@2025-08-01-preview' = {
  name: 'backend'
  properties: {
    environment: environment
    application: application
    containers: {
      api: {
        image: backendImage
        ports: {
          http: {
            containerPort: 8080
          }
        }
        livenessProbe: {
          httpGet: {
            path: '/healthz'
            port: 8080
          }
          initialDelaySeconds: 5
          periodSeconds: 10
        }
        readinessProbe: {
          httpGet: {
            path: '/readyz'
            port: 8080
          }
          initialDelaySeconds: 5
          periodSeconds: 10
        }
      }
    }
    connections: {
      db: {
        source: scoredb.id
      }
      cache: {
        source: cache.id
      }
      ai: {
        source: aimodel.id
      }
      storage: {
        source: themes.id
      }
    }
  }
}

// ---------------------------------------------------------------------------
// Score Processor — async worker (AKS Deployment via Recipe)
// Drains score queue from Azure Cache for Redis and writes to Azure PostgreSQL
// ---------------------------------------------------------------------------
resource scoreProcessor 'Radius.Compute/functions@2025-08-01-preview' = {
  name: 'scoreprocessor'
  properties: {
    environment: environment
    application: application
    image: scoreProcessorImage
    runtime: 'go'
    connections: {
      db: {
        source: scoredb.id
      }
      cache: {
        source: cache.id
      }
    }
  }
}

// ---------------------------------------------------------------------------
// Frontend — Nginx serving static Pac-Man game
// ---------------------------------------------------------------------------
resource frontend 'Radius.Compute/containers@2025-08-01-preview' = {
  name: 'frontend'
  properties: {
    environment: environment
    application: application
    containers: {
      web: {
        image: frontendImage
        ports: {
          http: {
            containerPort: 80
          }
        }
        livenessProbe: {
          httpGet: {
            path: '/'
            port: 80
          }
          initialDelaySeconds: 5
          periodSeconds: 15
        }
        readinessProbe: {
          httpGet: {
            path: '/'
            port: 80
          }
          initialDelaySeconds: 3
          periodSeconds: 10
        }
      }
    }
  }
}
