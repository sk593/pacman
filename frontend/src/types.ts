/** Cardinal directions for entity movement. */
export type Direction = 'up' | 'down' | 'left' | 'right';

/** Tile types that populate the maze grid. */
export enum Tile {
  EMPTY = 0,
  WALL = 1,
  PELLET = 2,
  POWER_PELLET = 3,
  GHOST_HOUSE = 4,
  GHOST_DOOR = 5,
  TUNNEL = 6,
}

/** Game state machine states. */
export type GameState =
  | 'start'
  | 'playing'
  | 'dying'
  | 'gameover'
  | 'levelcomplete'
  | 'paused';

/** Names of the four ghosts. */
export type GhostName = 'blinky' | 'pinky' | 'inky' | 'clyde';

/** Ghost behavioral modes. */
export type GhostMode = 'chase' | 'scatter' | 'frightened' | 'eaten';

/** A position on the tile grid. */
export interface Position {
  x: number;
  y: number;
}

/** Ghost entity state. */
export interface GhostState {
  name: GhostName;
  mode: GhostMode;
  position: Position;
  direction: Direction;
  speed: number;
  previousMode: GhostMode;
  frightTimer: number;
  isInHouse: boolean;
}

/** Pac-Man entity state. */
export interface PacManState {
  position: Position;
  direction: Direction;
  nextDirection: Direction | null;
  animationFrame: number;
  animationTimer: number;
  alive: boolean;
}

/** Running game session data (client-side only). */
export interface GameSession {
  score: number;
  lives: number;
  level: number;
  state: GameState;
  powerUpTimer: number;
}

/** High score entry returned from the API. */
export interface HighScoreEntry {
  id: number;
  player_name: string;
  score: number;
  level_reached: number;
  created_at: string;
}

/** Score submission payload sent to the API. */
export interface ScoreSubmission {
  player_name: string;
  score: number;
  level_reached: number;
}

/** Theme data returned from the backend API. */
export interface Theme {
  id: number;
  name: string;
  description: string;
  wall_color: string;
  pellet_color: string;
  pacman_color: string;
  background_color: string;
  ghost1_name: string;
  ghost2_name: string;
  ghost3_name: string;
  ghost4_name: string;
  ghost1_color: string;
  ghost2_color: string;
  ghost3_color: string;
  ghost4_color: string;
  // Emoji sprites (optional)
  wall_sprite: string;
  pellet_sprite: string;
  pacman_sprite: string;
  power_pellet_sprite: string;
  ghost1_sprite: string;
  ghost2_sprite: string;
  ghost3_sprite: string;
  ghost4_sprite: string;
  created_at: string;
}

/** Theme colors and sprites applied to the game renderer. */
export interface ThemeColors {
  wall: string;
  pellet: string;
  pacman: string;
  background: string;
  ghost1: string;
  ghost2: string;
  ghost3: string;
  ghost4: string;
  // Emoji sprites (empty string = use geometric shapes)
  wallSprite: string;
  pelletSprite: string;
  pacmanSprite: string;
  powerPelletSprite: string;
  ghost1Sprite: string;
  ghost2Sprite: string;
  ghost3Sprite: string;
  ghost4Sprite: string;
}
