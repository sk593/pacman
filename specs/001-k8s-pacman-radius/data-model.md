# Data Model: Cloud-Native Pac-Man

**Feature**: `001-k8s-pacman-radius`  
**Date**: 2026-02-20

## Entities

### 1. High Score Entry

The only persistent entity. Stored in the PostgreSQL `scores` table.

| Field | Type | Constraints | Description |
|-------|------|-------------|-------------|
| `id` | `SERIAL` (PK) | Auto-increment | Unique identifier |
| `player_name` | `VARCHAR(10)` | NOT NULL, 1–10 printable chars | Player's display name |
| `score` | `INTEGER` | NOT NULL, > 0 | Final game score |
| `level_reached` | `INTEGER` | NOT NULL, >= 1 | Highest level reached |
| `created_at` | `TIMESTAMPTZ` | NOT NULL, DEFAULT NOW() | When the score was submitted |

**Validation rules**:
- `player_name`: must match `^[\x20-\x7E]{1,10}$` (1–10 printable ASCII characters), trimmed of leading/trailing whitespace; reject if empty after trimming
- `score`: must be a positive integer
- `level_reached`: must be >= 1

**Indexes**:
- Primary key on `id`
- Descending index on `score` for top-10 leaderboard queries: `CREATE INDEX idx_scores_desc ON scores (score DESC)`

### 2. Game Session (Client-Side Only)

Not persisted in the database. Exists only in the browser's TypeScript runtime during gameplay.

| Field | Type | Description |
|-------|------|-------------|
| `score` | `number` | Current accumulated score |
| `lives` | `number` | Remaining lives (starts at 3) |
| `level` | `number` | Current level (starts at 1) |
| `state` | `enum` | `'start' \| 'playing' \| 'dying' \| 'gameover' \| 'levelcomplete'` |
| `powerUpTimer` | `number` | Remaining ms of power pellet effect |

### 3. Ghost (Client-Side Only)

| Field | Type | Description |
|-------|------|-------------|
| `name` | `enum` | `'blinky' \| 'pinky' \| 'inky' \| 'clyde'` |
| `mode` | `enum` | `'chase' \| 'scatter' \| 'frightened' \| 'eaten'` |
| `position` | `{x, y}` | Current tile position in the maze grid |
| `direction` | `enum` | `'up' \| 'down' \| 'left' \| 'right'` |
| `speed` | `number` | Tiles per tick (varies by level and mode) |

### 4. Pac-Man (Client-Side Only)

| Field | Type | Description |
|-------|------|-------------|
| `position` | `{x, y}` | Current tile position |
| `direction` | `enum` | `'up' \| 'down' \| 'left' \| 'right'` |
| `nextDirection` | `enum` | Queued input direction |
| `animationFrame` | `number` | Current sprite animation frame |

### 5. Maze (Client-Side Only)

| Field | Type | Description |
|-------|------|-------------|
| `grid` | `number[][]` | 28×31 tile grid; values encode wall, pellet, power pellet, empty, ghost house, tunnel |
| `totalPellets` | `number` | Total pellets at level start |
| `pelletsRemaining` | `number` | Pellets left (level complete when 0) |

## State Transitions

### Game State Machine

```
[START] ---(click/keypress)---> [PLAYING]
[PLAYING] ---(ghost collision)---> [DYING]
[DYING] ---(animation complete, lives > 0)---> [PLAYING]
[DYING] ---(animation complete, lives == 0)---> [GAME_OVER]
[PLAYING] ---(all pellets eaten)---> [LEVEL_COMPLETE]
[LEVEL_COMPLETE] ---(transition animation)---> [PLAYING] (next level)
[GAME_OVER] ---(score submitted)---> [START]
[PLAYING] ---(tab loses focus)---> [PAUSED]
[PAUSED] ---(tab gains focus)---> [PLAYING]
```

### Ghost Mode Transitions

```
[SCATTER] ---(timer expires)---> [CHASE]
[CHASE] ---(timer expires)---> [SCATTER]
[CHASE|SCATTER] ---(power pellet)---> [FRIGHTENED]
[FRIGHTENED] ---(timer expires)---> [previous mode]
[FRIGHTENED] ---(eaten by Pac-Man)---> [EATEN]
[EATEN] ---(reaches ghost house)---> [CHASE|SCATTER]
```

## Database Schema (DDL)

```sql
CREATE TABLE IF NOT EXISTS scores (
    id          SERIAL PRIMARY KEY,
    player_name VARCHAR(10) NOT NULL CHECK (char_length(trim(player_name)) >= 1),
    score       INTEGER NOT NULL CHECK (score > 0),
    level_reached INTEGER NOT NULL CHECK (level_reached >= 1),
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_scores_desc ON scores (score DESC);
```
