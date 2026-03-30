/**
 * pacman.ts — Pac-Man entity with tile-based movement, direction queue,
 * wall collision, animation frames, and respawn logic.
 */
import type { Direction, PacManState, Position } from './types';
import { Maze } from './maze';
import {
  PACMAN_SPEED,
  PACMAN_SPAWN,
  TILE_SIZE,
  LEVEL_SPEED_INCREASE,
  MAX_SPEED_MULTIPLIER,
} from './constants';

export class PacMan {
  state: PacManState;
  /** Sub-pixel position for smooth movement. */
  pixelX: number;
  pixelY: number;
  private speed: number;
  private moving: boolean;

  constructor() {
    this.state = {
      position: { ...PACMAN_SPAWN },
      direction: 'left',
      nextDirection: null,
      animationFrame: 0,
      animationTimer: 0,
      alive: true,
    };
    this.pixelX = PACMAN_SPAWN.x * TILE_SIZE + TILE_SIZE / 2;
    this.pixelY = PACMAN_SPAWN.y * TILE_SIZE + TILE_SIZE / 2;
    this.speed = PACMAN_SPEED;
    this.moving = false;
  }

  /** Reset Pac-Man to spawn position (after death or new level). */
  respawn(): void {
    this.state.position = { ...PACMAN_SPAWN };
    this.state.direction = 'left';
    this.state.nextDirection = null;
    this.state.animationFrame = 0;
    this.state.animationTimer = 0;
    this.state.alive = true;
    this.pixelX = PACMAN_SPAWN.x * TILE_SIZE + TILE_SIZE / 2;
    this.pixelY = PACMAN_SPAWN.y * TILE_SIZE + TILE_SIZE / 2;
    this.moving = false;
  }

  /** Set speed multiplier based on level. */
  setLevel(level: number): void {
    const multiplier = Math.min(
      1 + (level - 1) * LEVEL_SPEED_INCREASE,
      MAX_SPEED_MULTIPLIER,
    );
    this.speed = PACMAN_SPEED * multiplier;
  }

  /** Queue a direction from input. */
  queueDirection(dir: Direction): void {
    this.state.nextDirection = dir;
  }

  /** Update Pac-Man position for one tick (dt in seconds). */
  update(dt: number, maze: Maze): void {
    if (!this.state.alive) return;

    const movePixels = this.speed * TILE_SIZE * dt;

    // Check if we're at a tile center (close enough to snap)
    const tileX = this.state.position.x * TILE_SIZE + TILE_SIZE / 2;
    const tileY = this.state.position.y * TILE_SIZE + TILE_SIZE / 2;
    const distToCenter = Math.abs(this.pixelX - tileX) + Math.abs(this.pixelY - tileY);

    if (distToCenter < 2) {
      // Snap to tile center
      this.pixelX = tileX;
      this.pixelY = tileY;

      // Try queued direction first
      if (this.state.nextDirection) {
        const nextPos = maze.getNextPosition(this.state.position, this.state.nextDirection);
        if (maze.isWalkable(nextPos) || maze.isTunnel(nextPos)) {
          this.state.direction = this.state.nextDirection;
          this.state.nextDirection = null;
        }
      }

      // Check if current direction is walkable
      const ahead = maze.getNextPosition(this.state.position, this.state.direction);
      if (!maze.isWalkable(ahead) && !maze.isTunnel(ahead)) {
        this.moving = false;
        this.updateAnimation(dt);
        return;
      }

      this.moving = true;
    }

    if (!this.moving) {
      this.updateAnimation(dt);
      return;
    }

    // Move in current direction
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

    this.updateAnimation(dt);
  }

  /** Get the Pac-Man mouth opening angle for animation. */
  getMouthAngle(): number {
    // Oscillate between 0 and 45 degrees
    const frame = this.state.animationFrame % 8;
    const angles = [0, 10, 20, 35, 45, 35, 20, 10];
    return angles[frame] * (Math.PI / 180);
  }

  /** Get rotation angle based on direction (for drawing). */
  getRotation(): number {
    switch (this.state.direction) {
      case 'right': return 0;
      case 'down':  return Math.PI / 2;
      case 'left':  return Math.PI;
      case 'up':    return -Math.PI / 2;
    }
  }

  /** Get the current tile position. */
  getPosition(): Position {
    return this.state.position;
  }

  private updateAnimation(dt: number): void {
    this.state.animationTimer += dt * 1000;
    if (this.state.animationTimer >= 50) {
      this.state.animationFrame++;
      this.state.animationTimer = 0;
    }
  }
}
