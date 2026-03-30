/**
 * maze.ts — 28×31 tile grid data, wall collision, pellet tracking, tunnel wrapping.
 *
 * Grid encoding (matches Tile enum in types.ts):
 *   0 = EMPTY, 1 = WALL, 2 = PELLET, 3 = POWER_PELLET,
 *   4 = GHOST_HOUSE, 5 = GHOST_DOOR, 6 = TUNNEL
 */
import { Tile, type Position, type Direction } from './types';
import {
  COLS,
  ROWS,
  TUNNEL_LEFT,
  TUNNEL_RIGHT,
} from './constants';

/**
 * Classic Pac-Man maze layout (28 columns × 31 rows).
 * Each number represents a Tile enum value.
 */
const MAZE_DATA: number[][] = [
  // Row 0
  [1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1],
  // Row 1
  [1,2,2,2,2,2,2,2,2,2,2,2,2,1,1,2,2,2,2,2,2,2,2,2,2,2,2,1],
  // Row 2
  [1,2,1,1,1,1,2,1,1,1,1,1,2,1,1,2,1,1,1,1,1,2,1,1,1,1,2,1],
  // Row 3
  [1,3,1,1,1,1,2,1,1,1,1,1,2,1,1,2,1,1,1,1,1,2,1,1,1,1,3,1],
  // Row 4
  [1,2,1,1,1,1,2,1,1,1,1,1,2,1,1,2,1,1,1,1,1,2,1,1,1,1,2,1],
  // Row 5
  [1,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,1],
  // Row 6
  [1,2,1,1,1,1,2,1,1,2,1,1,1,1,1,1,1,1,2,1,1,2,1,1,1,1,2,1],
  // Row 7
  [1,2,1,1,1,1,2,1,1,2,1,1,1,1,1,1,1,1,2,1,1,2,1,1,1,1,2,1],
  // Row 8
  [1,2,2,2,2,2,2,1,1,2,2,2,2,1,1,2,2,2,2,1,1,2,2,2,2,2,2,1],
  // Row 9
  [1,1,1,1,1,1,2,1,1,1,1,1,0,1,1,0,1,1,1,1,1,2,1,1,1,1,1,1],
  // Row 10
  [0,0,0,0,0,1,2,1,1,1,1,1,0,1,1,0,1,1,1,1,1,2,1,0,0,0,0,0],
  // Row 11
  [0,0,0,0,0,1,2,1,1,0,0,0,0,0,0,0,0,0,0,1,1,2,1,0,0,0,0,0],
  // Row 12
  [0,0,0,0,0,1,2,1,1,0,1,1,1,5,5,1,1,1,0,1,1,2,1,0,0,0,0,0],
  // Row 13
  [1,1,1,1,1,1,2,1,1,0,1,4,4,4,4,4,4,1,0,1,1,2,1,1,1,1,1,1],
  // Row 14
  [6,0,0,0,0,0,2,0,0,0,1,4,4,4,4,4,4,1,0,0,0,2,0,0,0,0,0,6],
  // Row 15
  [1,1,1,1,1,1,2,1,1,0,1,4,4,4,4,4,4,1,0,1,1,2,1,1,1,1,1,1],
  // Row 16
  [0,0,0,0,0,1,2,1,1,0,1,1,1,1,1,1,1,1,0,1,1,2,1,0,0,0,0,0],
  // Row 17
  [0,0,0,0,0,1,2,1,1,0,0,0,0,0,0,0,0,0,0,1,1,2,1,0,0,0,0,0],
  // Row 18
  [0,0,0,0,0,1,2,1,1,0,1,1,1,1,1,1,1,1,0,1,1,2,1,0,0,0,0,0],
  // Row 19
  [1,1,1,1,1,1,2,1,1,0,1,1,1,1,1,1,1,1,0,1,1,2,1,1,1,1,1,1],
  // Row 20
  [1,2,2,2,2,2,2,2,2,2,2,2,2,1,1,2,2,2,2,2,2,2,2,2,2,2,2,1],
  // Row 21
  [1,2,1,1,1,1,2,1,1,1,1,1,2,1,1,2,1,1,1,1,1,2,1,1,1,1,2,1],
  // Row 22
  [1,3,2,2,1,1,2,2,2,2,2,2,2,0,0,2,2,2,2,2,2,2,1,1,2,2,3,1],
  // Row 23
  [1,1,1,2,1,1,2,1,1,2,1,1,1,1,1,1,1,1,2,1,1,2,1,1,2,1,1,1],
  // Row 24
  [1,1,1,2,1,1,2,1,1,2,1,1,1,1,1,1,1,1,2,1,1,2,1,1,2,1,1,1],
  // Row 25
  [1,2,2,2,2,2,2,1,1,2,2,2,2,1,1,2,2,2,2,1,1,2,2,2,2,2,2,1],
  // Row 26
  [1,2,1,1,1,1,1,1,1,1,1,1,2,1,1,2,1,1,1,1,1,1,1,1,1,1,2,1],
  // Row 27
  [1,2,1,1,1,1,1,1,1,1,1,1,2,1,1,2,1,1,1,1,1,1,1,1,1,1,2,1],
  // Row 28
  [1,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,1],
  // Row 29
  [1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1],
  // Row 30
  [0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],
];

export class Maze {
  /** Working copy of the grid (mutated as pellets are eaten). */
  grid: number[][];
  totalPellets: number;
  pelletsRemaining: number;

  constructor() {
    this.grid = this.cloneGrid();
    this.totalPellets = 0;
    this.pelletsRemaining = 0;
    this.countPellets();
  }

  /** Reset the maze to its original state for a new level. */
  reset(): void {
    this.grid = this.cloneGrid();
    this.countPellets();
  }

  /** Deep-clone the original maze data. */
  private cloneGrid(): number[][] {
    return MAZE_DATA.map(row => [...row]);
  }

  /** Count total and remaining pellets. */
  private countPellets(): void {
    let count = 0;
    for (let y = 0; y < ROWS; y++) {
      for (let x = 0; x < COLS; x++) {
        const t = this.grid[y][x];
        if (t === Tile.PELLET || t === Tile.POWER_PELLET) count++;
      }
    }
    this.totalPellets = count;
    this.pelletsRemaining = count;
  }

  /** Get the tile at a given position (bounds-safe). */
  getTile(pos: Position): Tile {
    if (pos.y < 0 || pos.y >= ROWS || pos.x < 0 || pos.x >= COLS) {
      return Tile.EMPTY;
    }
    return this.grid[pos.y][pos.x] as Tile;
  }

  /** Check whether a position is a wall (not walkable). */
  isWall(pos: Position): boolean {
    const tile = this.getTile(pos);
    return tile === Tile.WALL;
  }

  /** Check whether a position is walkable (not a wall or ghost house). */
  isWalkable(pos: Position): boolean {
    const tile = this.getTile(pos);
    return tile !== Tile.WALL && tile !== Tile.GHOST_HOUSE && tile !== Tile.GHOST_DOOR;
  }

  /** Check if a position is walkable for ghosts.
   * @param canEnterHouse — true only for eaten ghosts returning to respawn.
   */
  isGhostWalkable(pos: Position, canEnterHouse: boolean = false): boolean {
    const tile = this.getTile(pos);
    if (tile === Tile.WALL) return false;
    if (!canEnterHouse && (tile === Tile.GHOST_DOOR || tile === Tile.GHOST_HOUSE)) return false;
    return true;
  }

  /** Eat a pellet at position, return the tile type consumed (or null). */
  eatPellet(pos: Position): Tile | null {
    const tile = this.getTile(pos);
    if (tile === Tile.PELLET || tile === Tile.POWER_PELLET) {
      this.grid[pos.y][pos.x] = Tile.EMPTY;
      this.pelletsRemaining--;
      return tile;
    }
    return null;
  }

  /** Handle tunnel wrapping: if entity exits one side, appear on the other. */
  wrapTunnel(pos: Position): Position {
    if (pos.x < TUNNEL_LEFT.x && pos.y === TUNNEL_LEFT.y) {
      return { x: TUNNEL_RIGHT.x, y: pos.y };
    }
    if (pos.x > TUNNEL_RIGHT.x && pos.y === TUNNEL_RIGHT.y) {
      return { x: TUNNEL_LEFT.x, y: pos.y };
    }
    return pos;
  }

  /** Check if a position is in the tunnel zone. */
  isTunnel(pos: Position): boolean {
    return this.getTile(pos) === Tile.TUNNEL;
  }

  /** Get the next position in a given direction. */
  getNextPosition(pos: Position, dir: Direction): Position {
    switch (dir) {
      case 'up':    return { x: pos.x, y: pos.y - 1 };
      case 'down':  return { x: pos.x, y: pos.y + 1 };
      case 'left':  return { x: pos.x - 1, y: pos.y };
      case 'right': return { x: pos.x + 1, y: pos.y };
    }
  }

  /** Check if all pellets have been eaten. */
  isComplete(): boolean {
    return this.pelletsRemaining <= 0;
  }
}
