/**
 * ghost-ai.ts — Ghost AI targeting algorithms.
 *
 * Blinky (Red):   Direct chase — targets Pac-Man's current tile.
 * Pinky (Pink):   Ambush — targets 4 tiles ahead of Pac-Man's direction.
 * Inky (Cyan):    Flank — target is 2× vector from Blinky to 2 tiles ahead of Pac-Man.
 * Clyde (Orange): Shy — chases when >8 tiles away, retreats to scatter corner when ≤8.
 */
import type { Direction, Position } from './types';
import { Ghost } from './ghost';
import {
  CLYDE_SHY_DISTANCE,
  PINKY_AMBUSH_TILES,
  INKY_OFFSET_TILES,
  BLINKY_SPAWN,
  BLINKY_SCATTER,
  PINKY_SPAWN,
  PINKY_SCATTER,
  INKY_SPAWN,
  INKY_SCATTER,
  CLYDE_SPAWN,
  CLYDE_SCATTER,
} from './constants';

/**
 * Compute the target tile for a ghost based on its AI personality.
 */
export function getGhostTarget(
  ghost: Ghost,
  pacmanPos: Position,
  pacmanDir: Direction,
  blinkyPos: Position,
): Position {
  // In scatter mode, always target the scatter corner
  if (ghost.state.mode === 'scatter') {
    return ghost.scatterTarget;
  }

  // In chase mode, use personality-specific targeting
  switch (ghost.state.name) {
    case 'blinky':
      return targetBlinky(pacmanPos);
    case 'pinky':
      return targetPinky(pacmanPos, pacmanDir);
    case 'inky':
      return targetInky(pacmanPos, pacmanDir, blinkyPos);
    case 'clyde':
      return targetClyde(ghost, pacmanPos);
    default:
      return pacmanPos;
  }
}

/**
 * Blinky — Direct chase: targets Pac-Man's current tile.
 */
function targetBlinky(pacmanPos: Position): Position {
  return { ...pacmanPos };
}

/**
 * Pinky — Ambush: targets 4 tiles ahead of Pac-Man's facing direction.
 * (Faithfully reproduces the original overflow bug for 'up' direction.)
 */
function targetPinky(pacmanPos: Position, pacmanDir: Direction): Position {
  const offset = directionOffset(pacmanDir, PINKY_AMBUSH_TILES);

  // Original Pac-Man bug: when facing up, also offset left by the same amount
  if (pacmanDir === 'up') {
    return {
      x: pacmanPos.x + offset.x - PINKY_AMBUSH_TILES,
      y: pacmanPos.y + offset.y,
    };
  }

  return {
    x: pacmanPos.x + offset.x,
    y: pacmanPos.y + offset.y,
  };
}

/**
 * Inky — Flank: target is 2× the vector from Blinky's position
 * to 2 tiles ahead of Pac-Man.
 */
function targetInky(
  pacmanPos: Position,
  pacmanDir: Direction,
  blinkyPos: Position,
): Position {
  const offset = directionOffset(pacmanDir, INKY_OFFSET_TILES);
  const pivot = {
    x: pacmanPos.x + offset.x,
    y: pacmanPos.y + offset.y,
  };

  return {
    x: pivot.x + (pivot.x - blinkyPos.x),
    y: pivot.y + (pivot.y - blinkyPos.y),
  };
}

/**
 * Clyde — Shy: when >8 tiles from Pac-Man, targets Pac-Man directly.
 * When ≤8 tiles away, retreats to scatter corner.
 */
function targetClyde(ghost: Ghost, pacmanPos: Position): Position {
  const dx = ghost.state.position.x - pacmanPos.x;
  const dy = ghost.state.position.y - pacmanPos.y;
  const dist = Math.sqrt(dx * dx + dy * dy);

  if (dist > CLYDE_SHY_DISTANCE) {
    return { ...pacmanPos }; // Chase like Blinky
  }
  return ghost.scatterTarget; // Retreat to corner
}

/** Helper: get tile offset for a direction and distance. */
function directionOffset(dir: Direction, tiles: number): Position {
  switch (dir) {
    case 'up':    return { x: 0, y: -tiles };
    case 'down':  return { x: 0, y: tiles };
    case 'left':  return { x: -tiles, y: 0 };
    case 'right': return { x: tiles, y: 0 };
  }
}

/**
 * Create all four ghosts with their spawn positions and scatter corners.
 */
export function createGhosts(): Ghost[] {
  return [
    new Ghost('blinky', BLINKY_SPAWN, BLINKY_SCATTER),
    new Ghost('pinky', PINKY_SPAWN, PINKY_SCATTER),
    new Ghost('inky', INKY_SPAWN, INKY_SCATTER),
    new Ghost('clyde', CLYDE_SPAWN, CLYDE_SCATTER),
  ];
}
