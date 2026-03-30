/**
 * renderer.ts — Canvas 2D renderer for maze walls, pellets, Pac-Man,
 * ghost sprites, HUD (score, lives, level), start screen, and game-over screen.
 * Supports runtime theme switching via setTheme().
 */
import type { GhostName, HighScoreEntry, Theme, ThemeColors } from './types';
import { Tile } from './types';
import { Maze } from './maze';
import { PacMan } from './pacman';
import { Ghost } from './ghost';
import {
  COLS,
  ROWS,
  TILE_SIZE,
  CANVAS_WIDTH,
  CANVAS_HEIGHT,
  COLOR_WALL,
  COLOR_PELLET,
  COLOR_POWER_PELLET,
  COLOR_PACMAN,
  COLOR_BLINKY,
  COLOR_PINKY,
  COLOR_INKY,
  COLOR_CLYDE,
  COLOR_FRIGHTENED,
  COLOR_FRIGHTENED_FLASH,
  COLOR_EATEN,
  COLOR_BACKGROUND,
  COLOR_TEXT,
  COLOR_HUD,
  COLOR_GHOST_DOOR,
} from './constants';

/** Default theme colors derived from constants. */
const DEFAULT_THEME: ThemeColors = {
  wall: COLOR_WALL,
  pellet: COLOR_PELLET,
  pacman: COLOR_PACMAN,
  background: COLOR_BACKGROUND,
  ghost1: COLOR_BLINKY,
  ghost2: COLOR_PINKY,
  ghost3: COLOR_INKY,
  ghost4: COLOR_CLYDE,
  wallSprite: '',
  pelletSprite: '',
  pacmanSprite: '',
  powerPelletSprite: '',
  ghost1Sprite: '',
  ghost2Sprite: '',
  ghost3Sprite: '',
  ghost4Sprite: '',
};

export class Renderer {
  private ctx: CanvasRenderingContext2D;
  private frameCount: number = 0;
  private theme: ThemeColors = { ...DEFAULT_THEME };
  private ghostColors: Record<GhostName, string>;
  private ghostSprites: Record<GhostName, string>;

  constructor(ctx: CanvasRenderingContext2D) {
    this.ctx = ctx;
    this.ghostColors = {
      blinky: this.theme.ghost1,
      pinky: this.theme.ghost2,
      inky: this.theme.ghost3,
      clyde: this.theme.ghost4,
    };
    this.ghostSprites = {
      blinky: '',
      pinky: '',
      inky: '',
      clyde: '',
    };
  }

  /** Apply a theme to the renderer. Passing null resets to defaults. */
  setTheme(theme: Theme | null): void {
    if (theme) {
      this.theme = {
        wall: theme.wall_color,
        pellet: theme.pellet_color,
        pacman: theme.pacman_color,
        background: theme.background_color,
        ghost1: theme.ghost1_color,
        ghost2: theme.ghost2_color,
        ghost3: theme.ghost3_color,
        ghost4: theme.ghost4_color,
        wallSprite: theme.wall_sprite || '',
        pelletSprite: theme.pellet_sprite || '',
        pacmanSprite: theme.pacman_sprite || '',
        powerPelletSprite: theme.power_pellet_sprite || '',
        ghost1Sprite: theme.ghost1_sprite || '',
        ghost2Sprite: theme.ghost2_sprite || '',
        ghost3Sprite: theme.ghost3_sprite || '',
        ghost4Sprite: theme.ghost4_sprite || '',
      };
    } else {
      this.theme = { ...DEFAULT_THEME };
    }
    this.ghostColors = {
      blinky: this.theme.ghost1,
      pinky: this.theme.ghost2,
      inky: this.theme.ghost3,
      clyde: this.theme.ghost4,
    };
    this.ghostSprites = {
      blinky: this.theme.ghost1Sprite,
      pinky: this.theme.ghost2Sprite,
      inky: this.theme.ghost3Sprite,
      clyde: this.theme.ghost4Sprite,
    };
  }

  /** Get current theme colors (for external use). */
  getTheme(): ThemeColors {
    return { ...this.theme };
  }

  /** Clear the entire canvas. */
  clear(): void {
    this.ctx.fillStyle = this.theme.background;
    this.ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
  }

  /** Render the maze walls and pellets. */
  renderMaze(maze: Maze): void {
    this.frameCount++;

    for (let y = 0; y < ROWS; y++) {
      for (let x = 0; x < COLS; x++) {
        const tile = maze.grid[y][x];
        const px = x * TILE_SIZE;
        const py = y * TILE_SIZE;

        switch (tile) {
          case Tile.WALL:
            this.drawWall(px, py, x, y, maze);
            break;
          case Tile.PELLET:
            if (this.theme.pelletSprite) {
              this.ctx.font = '10px serif';
              this.ctx.textAlign = 'center';
              this.ctx.textBaseline = 'middle';
              this.ctx.fillText(this.theme.pelletSprite, px + TILE_SIZE / 2, py + TILE_SIZE / 2);
            } else {
              this.ctx.fillStyle = this.theme.pellet;
              this.ctx.beginPath();
              this.ctx.arc(
                px + TILE_SIZE / 2,
                py + TILE_SIZE / 2,
                2,
                0,
                Math.PI * 2,
              );
              this.ctx.fill();
            }
            break;
          case Tile.POWER_PELLET: {
            // Flashing power pellet
            const flash = Math.floor(this.frameCount / 10) % 2 === 0;
            if (flash) {
              if (this.theme.powerPelletSprite) {
                this.ctx.font = '14px serif';
                this.ctx.textAlign = 'center';
                this.ctx.textBaseline = 'middle';
                this.ctx.fillText(this.theme.powerPelletSprite, px + TILE_SIZE / 2, py + TILE_SIZE / 2);
              } else {
                this.ctx.fillStyle = COLOR_POWER_PELLET;
                this.ctx.beginPath();
                this.ctx.arc(
                  px + TILE_SIZE / 2,
                  py + TILE_SIZE / 2,
                  6,
                  0,
                  Math.PI * 2,
                );
                this.ctx.fill();
              }
            }
            break;
          }
          case Tile.GHOST_DOOR:
            this.ctx.fillStyle = COLOR_GHOST_DOOR;
            this.ctx.fillRect(px, py + TILE_SIZE / 2 - 1, TILE_SIZE, 2);
            break;
        }
      }
    }
  }

  /** Draw a wall tile with simple line segments or emoji sprite. */
  private drawWall(px: number, py: number, _x: number, _y: number, _maze: Maze): void {
    if (this.theme.wallSprite) {
      this.ctx.font = `${TILE_SIZE - 2}px serif`;
      this.ctx.textAlign = 'center';
      this.ctx.textBaseline = 'middle';
      this.ctx.fillText(this.theme.wallSprite, px + TILE_SIZE / 2, py + TILE_SIZE / 2);
    } else {
      this.ctx.fillStyle = this.theme.wall;
      this.ctx.fillRect(px + 1, py + 1, TILE_SIZE - 2, TILE_SIZE - 2);
    }
  }

  /** Render Pac-Man with mouth animation or emoji sprite. */
  renderPacman(pacman: PacMan): void {
    const { pixelX, pixelY } = pacman;

    if (this.theme.pacmanSprite) {
      this.ctx.save();
      this.ctx.font = `${TILE_SIZE}px serif`;
      this.ctx.textAlign = 'center';
      this.ctx.textBaseline = 'middle';
      this.ctx.fillText(this.theme.pacmanSprite, pixelX, pixelY);
      this.ctx.restore();
      return;
    }

    const rotation = pacman.getRotation();
    const mouth = pacman.getMouthAngle();

    this.ctx.save();
    this.ctx.translate(pixelX, pixelY);
    this.ctx.rotate(rotation);

    this.ctx.fillStyle = this.theme.pacman;
    this.ctx.beginPath();
    this.ctx.arc(0, 0, TILE_SIZE / 2 - 1, mouth, Math.PI * 2 - mouth);
    this.ctx.lineTo(0, 0);
    this.ctx.closePath();
    this.ctx.fill();

    this.ctx.restore();
  }

  /** Render a ghost with emoji sprite or geometric shape. */
  renderGhost(ghost: Ghost): void {
    const { pixelX, pixelY } = ghost;

    // Use emoji sprite if available and not in special mode
    const sprite = this.ghostSprites[ghost.state.name];
    if (sprite && ghost.state.mode !== 'frightened' && ghost.state.mode !== 'eaten') {
      this.ctx.font = `${TILE_SIZE}px serif`;
      this.ctx.textAlign = 'center';
      this.ctx.textBaseline = 'middle';
      this.ctx.fillText(sprite, pixelX, pixelY);
      return;
    }

    const size = TILE_SIZE / 2 - 1;

    let color: string;
    if (ghost.state.mode === 'frightened') {
      color = ghost.isFlashing()
        ? (Math.floor(this.frameCount / 5) % 2 === 0 ? COLOR_FRIGHTENED : COLOR_FRIGHTENED_FLASH)
        : COLOR_FRIGHTENED;
    } else if (ghost.state.mode === 'eaten') {
      color = COLOR_EATEN;
    } else {
      color = this.ghostColors[ghost.state.name];
    }

    this.ctx.fillStyle = color;

    // Ghost body (rounded top, wavy bottom)
    this.ctx.beginPath();
    this.ctx.arc(pixelX, pixelY - 2, size, Math.PI, 0, false);
    this.ctx.lineTo(pixelX + size, pixelY + size);

    // Wavy bottom
    const waveSize = size / 3;
    for (let i = 2; i >= -2; i--) {
      const wx = pixelX + (i * waveSize);
      const wy = pixelY + size + ((i + 2) % 2 === 0 ? -3 : 0);
      this.ctx.lineTo(wx, wy);
    }

    this.ctx.lineTo(pixelX - size, pixelY + size);
    this.ctx.closePath();
    this.ctx.fill();

    // Eyes
    if (ghost.state.mode !== 'frightened') {
      this.drawGhostEyes(pixelX, pixelY, ghost);
    } else {
      // Frightened face
      this.ctx.fillStyle = '#FFF';
      this.ctx.fillRect(pixelX - 3, pixelY - 2, 2, 2);
      this.ctx.fillRect(pixelX + 2, pixelY - 2, 2, 2);
    }
  }

  /** Draw ghost eyes (looking in movement direction). */
  private drawGhostEyes(x: number, y: number, ghost: Ghost): void {
    const eyeRadius = 3;
    const pupilRadius = 1.5;
    let pupilDx = 0;
    let pupilDy = 0;

    switch (ghost.state.direction) {
      case 'up':    pupilDy = -1.5; break;
      case 'down':  pupilDy = 1.5; break;
      case 'left':  pupilDx = -1.5; break;
      case 'right': pupilDx = 1.5; break;
    }

    // Left eye
    this.ctx.fillStyle = '#FFF';
    this.ctx.beginPath();
    this.ctx.arc(x - 3, y - 3, eyeRadius, 0, Math.PI * 2);
    this.ctx.fill();
    this.ctx.fillStyle = '#00F';
    this.ctx.beginPath();
    this.ctx.arc(x - 3 + pupilDx, y - 3 + pupilDy, pupilRadius, 0, Math.PI * 2);
    this.ctx.fill();

    // Right eye
    this.ctx.fillStyle = '#FFF';
    this.ctx.beginPath();
    this.ctx.arc(x + 3, y - 3, eyeRadius, 0, Math.PI * 2);
    this.ctx.fill();
    this.ctx.fillStyle = '#00F';
    this.ctx.beginPath();
    this.ctx.arc(x + 3 + pupilDx, y - 3 + pupilDy, pupilRadius, 0, Math.PI * 2);
    this.ctx.fill();
  }

  /** Render the HUD (score, lives, level). */
  renderHUD(score: number, lives: number, level: number): void {
    this.ctx.fillStyle = COLOR_HUD;
    this.ctx.font = '12px monospace';
    this.ctx.textAlign = 'left';
    this.ctx.fillText(`SCORE: ${score}`, 10, 12);

    this.ctx.textAlign = 'center';
    this.ctx.fillText(`LEVEL ${level}`, CANVAS_WIDTH / 2, 12);

    this.ctx.textAlign = 'right';
    // Draw lives as small Pac-Man icons or emoji sprites
    for (let i = 0; i < lives - 1; i++) {
      const lx = CANVAS_WIDTH - 20 - i * 20;
      if (this.theme.pacmanSprite) {
        this.ctx.font = '12px serif';
        this.ctx.textAlign = 'center';
        this.ctx.textBaseline = 'middle';
        this.ctx.fillText(this.theme.pacmanSprite, lx, 8);
      } else {
        this.ctx.fillStyle = this.theme.pacman;
        this.ctx.beginPath();
        this.ctx.arc(lx, 8, 6, 0.25, Math.PI * 2 - 0.25);
        this.ctx.lineTo(lx, 8);
        this.ctx.closePath();
        this.ctx.fill();
      }
    }
  }

  /** Render the start screen. */
  renderStartScreen(
    highScores: HighScoreEntry[],
    themeName: string = 'Classic',
    promptActive: boolean = false,
    promptText: string = '',
    generating: boolean = false,
    generateError: string | null = null,
  ): void {
    this.clear();

    this.ctx.fillStyle = this.theme.pacman;
    this.ctx.font = 'bold 24px monospace';
    this.ctx.textAlign = 'center';
    this.ctx.fillText('PAC-MAN', CANVAS_WIDTH / 2, 100);

    // High score
    if (highScores.length > 0) {
      this.ctx.fillStyle = COLOR_TEXT;
      this.ctx.font = '12px monospace';
      this.ctx.fillText(`HIGH SCORE: ${highScores[0].score}`, CANVAS_WIDTH / 2, 140);
    }

    // Leaderboard
    this.ctx.fillStyle = COLOR_TEXT;
    this.ctx.font = '10px monospace';
    this.ctx.fillText('TOP SCORES', CANVAS_WIDTH / 2, 175);

    const startY = 195;
    highScores.slice(0, 10).forEach((entry, i) => {
      const y = startY + i * 16;
      this.ctx.textAlign = 'left';
      this.ctx.fillStyle = i === 0 ? this.theme.pacman : COLOR_TEXT;
      this.ctx.fillText(
        `${(i + 1).toString().padStart(2)}. ${entry.player_name.padEnd(10)} ${entry.score.toString().padStart(8)}`,
        80,
        y,
      );
    });

    // Controls
    const controlsY = highScores.length > 0
      ? startY + Math.min(highScores.length, 10) * 16 + 30
      : 200;

    this.ctx.textAlign = 'center';
    this.ctx.fillStyle = '#AAA';
    this.ctx.font = '10px monospace';
    this.ctx.fillText('Use your mouse, arrow keys,', CANVAS_WIDTH / 2, controlsY);
    this.ctx.fillText('or WASD to move', CANVAS_WIDTH / 2, controlsY + 16);

    // Theme selector
    this.ctx.fillStyle = this.theme.pellet;
    this.ctx.font = '10px monospace';
    this.ctx.fillText(`THEME: ${themeName}`, CANVAS_WIDTH / 2, controlsY + 36);
    this.ctx.fillStyle = '#888';
    this.ctx.font = '9px monospace';
    this.ctx.fillText('T: CYCLE THEME  |  G: GENERATE WITH AI', CANVAS_WIDTH / 2, controlsY + 50);

    // AI theme generation prompt
    if (promptActive || generating) {
      const promptY = controlsY + 68;

      // Background box
      this.ctx.fillStyle = 'rgba(0, 0, 0, 0.85)';
      this.ctx.fillRect(20, promptY - 14, CANVAS_WIDTH - 40, generating ? 36 : 52);
      this.ctx.strokeStyle = this.theme.pellet;
      this.ctx.lineWidth = 1;
      this.ctx.strokeRect(20, promptY - 14, CANVAS_WIDTH - 40, generating ? 36 : 52);

      if (generating) {
        // Loading indicator
        const dots = '.'.repeat((Math.floor(this.frameCount / 20) % 3) + 1);
        this.ctx.fillStyle = this.theme.pacman;
        this.ctx.font = '10px monospace';
        this.ctx.fillText(`Generating theme${dots}`, CANVAS_WIDTH / 2, promptY + 6);
      } else {
        // Prompt label
        this.ctx.fillStyle = this.theme.pacman;
        this.ctx.font = '10px monospace';
        this.ctx.fillText('Describe your theme:', CANVAS_WIDTH / 2, promptY + 2);

        // Input text with cursor
        const cursor = Math.floor(this.frameCount / 30) % 2 === 0 ? '|' : '';
        this.ctx.fillStyle = COLOR_TEXT;
        this.ctx.font = '10px monospace';
        const displayText = promptText.length > 30
          ? '...' + promptText.slice(-27) + cursor
          : (promptText || '') + cursor;
        this.ctx.fillText(displayText, CANVAS_WIDTH / 2, promptY + 20);

        // Help text
        this.ctx.fillStyle = '#666';
        this.ctx.font = '8px monospace';
        this.ctx.fillText('ENTER: Generate  |  ESC: Cancel', CANVAS_WIDTH / 2, promptY + 36);
      }

      // Error message
      if (generateError) {
        this.ctx.fillStyle = '#FF4444';
        this.ctx.font = '9px monospace';
        this.ctx.fillText(generateError, CANVAS_WIDTH / 2, promptY + (generating ? 24 : 50));
      }
    } else {
      // Start prompt (flashing) — only when prompt not active
      if (Math.floor(this.frameCount / 30) % 2 === 0) {
        this.ctx.fillStyle = COLOR_TEXT;
        this.ctx.font = '12px monospace';
        this.ctx.fillText('PRESS ANYWHERE TO START', CANVAS_WIDTH / 2, controlsY + 70);
      }
    }
  }

  /** Render the game-over screen. */
  renderGameOver(score: number, level: number): void {
    // Semi-transparent overlay
    this.ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
    this.ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

    this.ctx.fillStyle = '#FF0000';
    this.ctx.font = 'bold 20px monospace';
    this.ctx.textAlign = 'center';
    this.ctx.fillText('GAME OVER', CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2 - 60);

    this.ctx.fillStyle = COLOR_TEXT;
    this.ctx.font = '14px monospace';
    this.ctx.fillText(`SCORE: ${score}`, CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2 - 20);
    this.ctx.fillText(`LEVEL: ${level}`, CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2 + 5);
  }

  /** Render a score submission form overlay. */
  renderScoreForm(_score: number, playerName: string, submitted: boolean, errorMsg: string | null): void {
    const centerY = CANVAS_HEIGHT / 2 + 40;

    if (submitted) {
      this.ctx.fillStyle = '#00FF00';
      this.ctx.font = '12px monospace';
      this.ctx.textAlign = 'center';
      this.ctx.fillText('SCORE SAVED!', CANVAS_WIDTH / 2, centerY);
      this.ctx.fillStyle = COLOR_TEXT;
      this.ctx.font = '10px monospace';
      this.ctx.fillText('PRESS ANY KEY TO CONTINUE', CANVAS_WIDTH / 2, centerY + 25);
      return;
    }

    if (errorMsg) {
      this.ctx.fillStyle = '#FF4444';
      this.ctx.font = '10px monospace';
      this.ctx.textAlign = 'center';
      this.ctx.fillText(errorMsg, CANVAS_WIDTH / 2, centerY - 10);
    }

    this.ctx.fillStyle = COLOR_TEXT;
    this.ctx.font = '10px monospace';
    this.ctx.textAlign = 'center';
    this.ctx.fillText('ENTER YOUR NAME:', CANVAS_WIDTH / 2, centerY);

    // Name input box
    const boxW = 120;
    const boxH = 20;
    const boxX = CANVAS_WIDTH / 2 - boxW / 2;
    const boxY = centerY + 8;

    this.ctx.strokeStyle = COLOR_TEXT;
    this.ctx.lineWidth = 1;
    this.ctx.strokeRect(boxX, boxY, boxW, boxH);

    this.ctx.fillStyle = this.theme.pacman;
    this.ctx.font = '14px monospace';
    this.ctx.textAlign = 'center';
    this.ctx.fillText(playerName + '_', CANVAS_WIDTH / 2, boxY + 15);

    this.ctx.fillStyle = '#AAA';
    this.ctx.font = '9px monospace';
    this.ctx.fillText('PRESS ENTER TO SUBMIT', CANVAS_WIDTH / 2, boxY + 35);
  }

  /** Render the "READY!" message. */
  renderReady(): void {
    this.ctx.fillStyle = this.theme.pacman;
    this.ctx.font = 'bold 14px monospace';
    this.ctx.textAlign = 'center';
    this.ctx.fillText('READY!', CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2 + 16);
  }

  /** Render the "LEVEL COMPLETE" message. */
  renderLevelComplete(level: number): void {
    this.ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
    this.ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

    this.ctx.fillStyle = this.theme.pacman;
    this.ctx.font = 'bold 16px monospace';
    this.ctx.textAlign = 'center';
    this.ctx.fillText(`LEVEL ${level} COMPLETE!`, CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2);
  }

  /** Render the dying animation (Pac-Man shrinking). */
  renderDying(pacman: PacMan, progress: number): void {
    const { pixelX, pixelY } = pacman;
    const startAngle = progress * Math.PI;
    const endAngle = Math.PI * 2 - startAngle;

    if (startAngle >= Math.PI) return; // Fully disappeared

    this.ctx.save();
    this.ctx.translate(pixelX, pixelY);

    this.ctx.fillStyle = this.theme.pacman;
    this.ctx.beginPath();
    this.ctx.arc(0, 0, TILE_SIZE / 2 - 1, startAngle, endAngle);
    this.ctx.lineTo(0, 0);
    this.ctx.closePath();
    this.ctx.fill();

    this.ctx.restore();
  }
}
