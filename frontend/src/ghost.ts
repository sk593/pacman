/**
 * ghost.ts — Ghost base class with movement, scatter/chase/frightened/eaten
 * mode transitions, and mode timer.
 */
import type { Direction, GhostName, GhostState, Position } from './types';
import { Maze } from './maze';
import {
  GHOST_SPEED,
  GHOST_FRIGHTENED_SPEED,
  GHOST_EATEN_SPEED,
  GHOST_TUNNEL_SPEED,
  GHOST_HOUSE_CENTER,
  GHOST_HOUSE_EXIT,
  TILE_SIZE,
  SCATTER_CHASE_TIMERS,
  POWER_PELLET_DURATION,
  LEVEL_SPEED_INCREASE,
  MAX_SPEED_MULTIPLIER,
} from './constants';

/** Get the opposite direction. */
export function oppositeDirection(dir: Direction): Direction {
  switch (dir) {
    case 'up': return 'down';
    case 'down': return 'up';
    case 'left': return 'right';
    case 'right': return 'left';
  }
}

/** All four cardinal directions. */
const DIRECTIONS: Direction[] = ['up', 'left', 'down', 'right'];

export class Ghost {
  state: GhostState;
  pixelX: number;
  pixelY: number;

  /** Scatter/chase phase timer. */
  private scatterChaseTimer: number = 0;
  private scatterChaseIndex: number = 0;
  private isScatterPhase: boolean = true;

  /** Frightened mode timer. */
  private frightTimer: number = 0;

  /** Speed multiplier from level. */
  private levelMultiplier: number = 1;

  /** Spawn position for this ghost. */
  private spawnPos: Position;

  /** Last tile where a direction decision was made (prevents oscillation). */
  private lastDecisionTile: Position = { x: -1, y: -1 };

  /** Timer for in-house bounce animation. */
  private houseTimer: number = 0;

  /** Timer for reviving inside ghost house after being eaten. */
  private reviveTimer: number = 0;
  private isReviving: boolean = false;

  /** Scatter corner for this ghost. */
  scatterTarget: Position;

  constructor(
    name: GhostName,
    spawnPos: Position,
    scatterTarget: Position,
  ) {
    this.spawnPos = { ...spawnPos };
    this.scatterTarget = { ...scatterTarget };

    this.state = {
      name,
      mode: 'scatter',
      position: { ...spawnPos },
      direction: 'left',
      speed: GHOST_SPEED,
      previousMode: 'scatter',
      frightTimer: 0,
      isInHouse: name !== 'blinky', // Blinky starts outside
    };

    this.pixelX = spawnPos.x * TILE_SIZE + TILE_SIZE / 2;
    this.pixelY = spawnPos.y * TILE_SIZE + TILE_SIZE / 2;
  }

  /** Reset ghost for new life or level. */
  reset(): void {
    this.state.position = { ...this.spawnPos };
    this.state.direction = 'left';
    this.state.mode = 'scatter';
    this.state.previousMode = 'scatter';
    this.state.frightTimer = 0;
    this.state.isInHouse = this.state.name !== 'blinky';
    this.pixelX = this.spawnPos.x * TILE_SIZE + TILE_SIZE / 2;
    this.pixelY = this.spawnPos.y * TILE_SIZE + TILE_SIZE / 2;
    this.scatterChaseTimer = 0;
    this.scatterChaseIndex = 0;
    this.isScatterPhase = true;
    this.frightTimer = 0;
    this.lastDecisionTile = { x: -1, y: -1 };
    this.houseTimer = 0;
    this.reviveTimer = 0;
    this.isReviving = false;
  }

  /** Set level-based speed multiplier. */
  setLevel(level: number): void {
    this.levelMultiplier = Math.min(
      1 + (level - 1) * LEVEL_SPEED_INCREASE,
      MAX_SPEED_MULTIPLIER,
    );
  }

  /** Trigger frightened mode (power pellet eaten). */
  frighten(): void {
    if (this.state.mode === 'eaten') return;

    this.state.previousMode = this.state.mode === 'frightened'
      ? this.state.previousMode
      : this.state.mode;
    this.state.mode = 'frightened';
    this.frightTimer = POWER_PELLET_DURATION;
    this.state.frightTimer = POWER_PELLET_DURATION;

    // Reverse direction on frighten
    this.state.direction = oppositeDirection(this.state.direction);
    this.lastDecisionTile = { x: -1, y: -1 };
  }

  /** Ghost has been eaten by Pac-Man. */
  eat(): void {
    this.state.mode = 'eaten';
    this.frightTimer = 0;
    this.state.frightTimer = 0;
    this.lastDecisionTile = { x: -1, y: -1 };
  }

  /** Release ghost from house. */
  release(): void {
    this.state.isInHouse = false;
    this.state.position = { ...GHOST_HOUSE_CENTER };
    this.state.position.y = 11; // Move above ghost house
    this.pixelX = this.state.position.x * TILE_SIZE + TILE_SIZE / 2;
    this.pixelY = this.state.position.y * TILE_SIZE + TILE_SIZE / 2;
    this.lastDecisionTile = { x: -1, y: -1 };
  }

  /** Get the current speed in tiles/second. */
  getCurrentSpeed(maze: Maze): number {
    let base: number;

    switch (this.state.mode) {
      case 'frightened':
        base = GHOST_FRIGHTENED_SPEED;
        break;
      case 'eaten':
        base = GHOST_EATEN_SPEED;
        break;
      default:
        base = maze.isTunnel(this.state.position)
          ? GHOST_TUNNEL_SPEED
          : GHOST_SPEED;
    }

    return base * this.levelMultiplier;
  }

  /** Get the target tile for this ghost. Override in ghost-ai.ts. */
  getTargetTile(_pacmanPos: Position, _pacmanDir: Direction, _blinkyPos: Position): Position {
    return this.scatterTarget;
  }

  /**
   * Update ghost for one tick.
   * @param dt - Time delta in seconds
   * @param maze - Maze for collision
   * @param targetTile - Target tile computed by ghost AI
   */
  update(dt: number, maze: Maze, targetTile: Position): void {
    // Update scatter/chase timer
    this.updateScatterChase(dt);

    // Update frightened timer
    if (this.state.mode === 'frightened') {
      this.frightTimer -= dt * 1000;
      this.state.frightTimer = this.frightTimer;
      if (this.frightTimer <= 0) {
        this.state.mode = this.isScatterPhase ? 'scatter' : 'chase';
        this.frightTimer = 0;
        this.state.frightTimer = 0;
      }
    }

    // If in ghost house, bob up and down while waiting for release
    if (this.state.isInHouse) {
      // Handle reviving after being eaten: brief pause then exit
      if (this.isReviving) {
        this.reviveTimer -= dt;
        const centerY = this.spawnPos.y * TILE_SIZE + TILE_SIZE / 2;
        this.pixelY = centerY + Math.sin(this.houseTimer * 6) * 3;
        this.houseTimer += dt;
        if (this.reviveTimer <= 0) {
          this.isReviving = false;
          this.release();
        }
        return;
      }
      this.houseTimer += dt;
      const centerY = this.spawnPos.y * TILE_SIZE + TILE_SIZE / 2;
      this.pixelY = centerY + Math.sin(this.houseTimer * 3) * 4;
      return;
    }

    // If eaten, navigate to ghost house door
    if (this.state.mode === 'eaten') {
      const doorDist = Math.abs(this.state.position.x - GHOST_HOUSE_EXIT.x)
        + Math.abs(this.state.position.y - GHOST_HOUSE_EXIT.y);
      if (doorDist <= 1) {
        // Arrived at door — enter house, revive briefly, then exit
        this.state.mode = this.isScatterPhase ? 'scatter' : 'chase';
        this.state.isInHouse = true;
        this.isReviving = true;
        this.reviveTimer = 0.5; // half-second inside the house
        this.houseTimer = 0;
        this.state.position = { ...this.spawnPos };
        this.pixelX = this.spawnPos.x * TILE_SIZE + TILE_SIZE / 2;
        this.pixelY = this.spawnPos.y * TILE_SIZE + TILE_SIZE / 2;
        this.lastDecisionTile = { x: -1, y: -1 };
        return;
      }
    }

    const speed = this.getCurrentSpeed(maze);
    const movePixels = speed * TILE_SIZE * dt;

    // Check if at tile center
    const tileX = this.state.position.x * TILE_SIZE + TILE_SIZE / 2;
    const tileY = this.state.position.y * TILE_SIZE + TILE_SIZE / 2;
    const distToCenter = Math.abs(this.pixelX - tileX) + Math.abs(this.pixelY - tileY);

    if (distToCenter < 2) {
      // Only make a direction decision when entering a NEW tile center
      // (prevents oscillation when per-frame movement < snap threshold)
      const pos = this.state.position;
      if (pos.x !== this.lastDecisionTile.x || pos.y !== this.lastDecisionTile.y) {
        this.pixelX = tileX;
        this.pixelY = tileY;

        // Choose next direction at tile center
        const target = this.state.mode === 'eaten'
          ? GHOST_HOUSE_EXIT
          : targetTile;

        this.state.direction = this.chooseDirection(maze, target);
        this.lastDecisionTile = { x: pos.x, y: pos.y };
      }
    }

    // Move
    switch (this.state.direction) {
      case 'up':    this.pixelY -= movePixels; break;
      case 'down':  this.pixelY += movePixels; break;
      case 'left':  this.pixelX -= movePixels; break;
      case 'right': this.pixelX += movePixels; break;
    }

    // Update tile position
    this.state.position = {
      x: Math.round((this.pixelX - TILE_SIZE / 2) / TILE_SIZE),
      y: Math.round((this.pixelY - TILE_SIZE / 2) / TILE_SIZE),
    };

    // Tunnel wrapping
    const wrapped = maze.wrapTunnel(this.state.position);
    if (wrapped.x !== this.state.position.x || wrapped.y !== this.state.position.y) {
      this.state.position = wrapped;
      this.pixelX = wrapped.x * TILE_SIZE + TILE_SIZE / 2;
      this.pixelY = wrapped.y * TILE_SIZE + TILE_SIZE / 2;
    }
  }

  /** Choose the best direction at an intersection. */
  private chooseDirection(maze: Maze, target: Position): Direction {
    if (this.state.mode === 'frightened') {
      return this.chooseRandomDirection(maze);
    }

    const current = this.state.position;
    const reverse = oppositeDirection(this.state.direction);
    const canEnterHouse = this.state.mode === 'eaten';
    let bestDir = this.state.direction;
    let bestDist = Infinity;

    for (const dir of DIRECTIONS) {
      if (dir === reverse) continue; // Never reverse

      const next = maze.getNextPosition(current, dir);
      if (!maze.isGhostWalkable(next, canEnterHouse)) continue;

      const dist = euclideanDist(next, target);
      if (dist < bestDist) {
        bestDist = dist;
        bestDir = dir;
      }
    }

    return bestDir;
  }

  /** Choose a random valid direction (for frightened mode). */
  private chooseRandomDirection(maze: Maze): Direction {
    const current = this.state.position;
    const reverse = oppositeDirection(this.state.direction);
    const valid: Direction[] = [];

    for (const dir of DIRECTIONS) {
      if (dir === reverse) continue;
      const next = maze.getNextPosition(current, dir);
      if (maze.isGhostWalkable(next, false)) {
        valid.push(dir);
      }
    }

    if (valid.length === 0) return reverse; // Dead end
    return valid[Math.floor(Math.random() * valid.length)];
  }

  /** Update scatter/chase phases on timer. */
  private updateScatterChase(dt: number): void {
    if (this.state.mode === 'frightened' || this.state.mode === 'eaten') return;

    this.scatterChaseTimer += dt;

    const phaseIdx = Math.min(this.scatterChaseIndex, SCATTER_CHASE_TIMERS.length - 1);
    const [scatterTime, chaseTime] = SCATTER_CHASE_TIMERS[phaseIdx];
    const threshold = this.isScatterPhase ? scatterTime : chaseTime;

    if (this.scatterChaseTimer >= threshold) {
      this.scatterChaseTimer = 0;

      if (this.isScatterPhase) {
        this.isScatterPhase = false;
        this.state.mode = 'chase';
      } else {
        this.isScatterPhase = true;
        this.state.mode = 'scatter';
        this.scatterChaseIndex++;
      }

      // Reverse direction on mode switch
      this.state.direction = oppositeDirection(this.state.direction);
      this.lastDecisionTile = { x: -1, y: -1 };
    }
  }

  /** Check if ghost is currently flashing (near end of frightened). */
  isFlashing(): boolean {
    return this.state.mode === 'frightened' && this.frightTimer < 2000;
  }
}

/** Euclidean distance between two tile positions. */
function euclideanDist(a: Position, b: Position): number {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  return Math.sqrt(dx * dx + dy * dy);
}
