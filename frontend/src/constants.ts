// --- Grid ---
export const COLS = 28;
export const ROWS = 31;
export const TILE_SIZE = 16;
export const CANVAS_WIDTH = COLS * TILE_SIZE;   // 448
export const CANVAS_HEIGHT = ROWS * TILE_SIZE;  // 496

// --- Speeds (tiles per second) ---
export const PACMAN_SPEED = 7.5;
export const GHOST_SPEED = 7.0;
export const GHOST_FRIGHTENED_SPEED = 3.5;
export const GHOST_EATEN_SPEED = 14.0;
export const GHOST_TUNNEL_SPEED = 4.0;

// --- Speed scaling per level (multiplier) ---
export const LEVEL_SPEED_INCREASE = 0.05;
export const MAX_SPEED_MULTIPLIER = 1.5;

// --- Timers (milliseconds) ---
export const POWER_PELLET_DURATION = 6000;
export const POWER_PELLET_FLASH_TIME = 2000;
export const DYING_ANIMATION_DURATION = 1500;
export const LEVEL_COMPLETE_DELAY = 2000;
export const GHOST_RELEASE_INTERVAL = 5000;
export const READY_MESSAGE_DURATION = 2000;

// --- Scatter/Chase alternation (seconds per phase) ---
export const SCATTER_CHASE_TIMERS: readonly [number, number][] = [
  [7, 20],   // scatter 7s, chase 20s
  [7, 20],
  [5, 20],
  [5, Infinity], // final chase lasts forever
];

// --- Points ---
export const POINTS_PELLET = 10;
export const POINTS_POWER_PELLET = 50;
export const POINTS_GHOST_BASE = 200;  // doubles per consecutive ghost eaten
export const POINTS_FRUIT = 100;
export const EXTRA_LIFE_SCORE = 10000;

// --- Lives ---
export const STARTING_LIVES = 3;
export const MAX_LIVES = 5;

// --- Ghost house / spawn positions (tile coords) ---
export const PACMAN_SPAWN = { x: 14, y: 23 };
export const BLINKY_SPAWN = { x: 14, y: 11 };
export const PINKY_SPAWN = { x: 14, y: 14 };
export const INKY_SPAWN = { x: 12, y: 14 };
export const CLYDE_SPAWN = { x: 16, y: 14 };
export const GHOST_HOUSE_CENTER = { x: 14, y: 14 };
export const GHOST_HOUSE_EXIT = { x: 14, y: 11 };  // tile just above the ghost door

// --- Scatter corners (tile coords) ---
export const BLINKY_SCATTER = { x: 25, y: 0 };
export const PINKY_SCATTER = { x: 2, y: 0 };
export const INKY_SCATTER = { x: 27, y: 30 };
export const CLYDE_SCATTER = { x: 0, y: 30 };

// --- Ghost AI ---
export const CLYDE_SHY_DISTANCE = 8; // tiles — switches to scatter when ≤ this
export const PINKY_AMBUSH_TILES = 4;
export const INKY_OFFSET_TILES = 2;

// --- Tunnel ---
export const TUNNEL_LEFT = { x: 0, y: 14 };
export const TUNNEL_RIGHT = { x: 27, y: 14 };

// --- Colors ---
export const COLOR_WALL = '#2121DE';
export const COLOR_PELLET = '#FFCC00';
export const COLOR_POWER_PELLET = '#FFCC00';
export const COLOR_PACMAN = '#FFFF00';
export const COLOR_BLINKY = '#FF0000';
export const COLOR_PINKY = '#FFB8FF';
export const COLOR_INKY = '#00FFFF';
export const COLOR_CLYDE = '#FFB852';
export const COLOR_FRIGHTENED = '#2121FF';
export const COLOR_FRIGHTENED_FLASH = '#FFFFFF';
export const COLOR_EATEN = '#CCCCCC';
export const COLOR_BACKGROUND = '#000000';
export const COLOR_TEXT = '#FFFFFF';
export const COLOR_HUD = '#FFFFFF';
export const COLOR_GHOST_DOOR = '#FFB8FF';

// --- Fonts ---
export const FONT_FAMILY = '"Press Start 2P", monospace';
export const FONT_SIZE_TITLE = 20;
export const FONT_SIZE_HUD = 12;
export const FONT_SIZE_SMALL = 10;

// --- API ---
export const API_BASE = '/api';
export const LEADERBOARD_SIZE = 10;
