/**
 * game.ts — Game state machine (start, playing, dying, gameover, levelcomplete, paused)
 * with 60fps requestAnimationFrame loop, delta-time accumulator, and level progression.
 */
import type { GameState, HighScoreEntry } from './types';
import { Tile } from './types';
import { Maze } from './maze';
import { PacMan } from './pacman';
import { Ghost } from './ghost';
import { getGhostTarget, createGhosts } from './ghost-ai';
import { InputHandler } from './input';
import { Renderer } from './renderer';
import { fetchLeaderboard, submitScore } from './score-client';
import { fetchThemes, generateTheme } from './theme-client';
import type { Theme } from './types';
import * as audio from './audio';
import {
  POINTS_PELLET,
  POINTS_POWER_PELLET,
  POINTS_GHOST_BASE,
  STARTING_LIVES,
  MAX_LIVES,
  EXTRA_LIFE_SCORE,
  DYING_ANIMATION_DURATION,
  LEVEL_COMPLETE_DELAY,
  READY_MESSAGE_DURATION,
  GHOST_RELEASE_INTERVAL,
} from './constants';

const TICK_RATE = 1000 / 60; // 16.67ms per tick

export class Game {
  private state: GameState = 'start';
  private score: number = 0;
  private lives: number = STARTING_LIVES;
  private level: number = 1;
  private ghostsEatenCombo: number = 0;
  private extraLifeAwarded: boolean = false;

  private maze: Maze;
  private pacman: PacMan;
  private ghosts: Ghost[];
  private input: InputHandler;
  private renderer: Renderer;

  // Timers
  private stateTimer: number = 0;
  private ghostReleaseTimer: number = 0;
  private ghostsReleased: number = 1; // Blinky starts released
  private readyTimer: number = 0;
  private showReady: boolean = false;

  // Game loop
  private lastTime: number = 0;
  private accumulator: number = 0;
  private running: boolean = false;

  // Leaderboard
  private highScores: HighScoreEntry[] = [];

  // Score submission
  private playerName: string = '';
  private scoreSubmitted: boolean = false;
  private submitError: string | null = null;
  private nameInputActive: boolean = false;

  // Themes
  private themes: Theme[] = [];
  private selectedThemeIndex: number = -1; // -1 = classic

  // AI theme generation
  private themePromptActive: boolean = false;
  private themePromptText: string = '';
  private themeGenerating: boolean = false;
  private themeGenerateError: string | null = null;

  constructor(
    canvas: HTMLCanvasElement,
    ctx: CanvasRenderingContext2D,
  ) {
    this.maze = new Maze();
    this.pacman = new PacMan();
    this.ghosts = createGhosts();
    this.input = new InputHandler(canvas);
    this.renderer = new Renderer(ctx);

    this.bindNameInput();
  }

  /** Start the game loop. */
  async start(): Promise<void> {
    // Load high scores and themes in parallel
    const [scores, themes] = await Promise.all([
      fetchLeaderboard(),
      fetchThemes(),
    ]);
    this.highScores = scores;
    this.themes = themes;

    this.state = 'start';
    this.running = true;

    // Wait for any input on start screen
    this.input.onAnyInput(() => this.startNewGame());

    this.lastTime = performance.now();
    requestAnimationFrame((t) => this.loop(t));
  }

  /** Main game loop with delta-time accumulator. */
  private loop(timestamp: number): void {
    if (!this.running) return;

    const delta = timestamp - this.lastTime;
    this.lastTime = timestamp;
    this.accumulator += delta;

    while (this.accumulator >= TICK_RATE) {
      this.update(TICK_RATE / 1000); // Convert to seconds
      this.accumulator -= TICK_RATE;
    }

    this.render();
    requestAnimationFrame((t) => this.loop(t));
  }

  /** Update game logic for one tick. */
  private update(dt: number): void {
    switch (this.state) {
      case 'start':
        break; // Waiting for input

      case 'playing':
        this.updatePlaying(dt);
        break;

      case 'dying':
        this.stateTimer += dt * 1000;
        if (this.stateTimer >= DYING_ANIMATION_DURATION) {
          if (this.lives <= 0) {
            this.state = 'gameover';
            this.nameInputActive = true;
            this.playerName = '';
            this.scoreSubmitted = false;
            this.submitError = null;
            audio.playGameOver();
          } else {
            this.resetPositions();
            this.showReady = true;
            this.readyTimer = READY_MESSAGE_DURATION;
            this.state = 'playing';
          }
        }
        break;

      case 'levelcomplete':
        this.stateTimer += dt * 1000;
        if (this.stateTimer >= LEVEL_COMPLETE_DELAY) {
          this.nextLevel();
        }
        break;

      case 'gameover':
        break; // Waiting for name input

      case 'paused':
        break;
    }
  }

  /** Update logic during active gameplay. */
  private updatePlaying(dt: number): void {
    // Ready message countdown
    if (this.showReady) {
      this.readyTimer -= dt * 1000;
      if (this.readyTimer <= 0) {
        this.showReady = false;
      }
      return; // Don't update gameplay during READY
    }

    // Process input
    const dir = this.input.consumeDirection();
    if (dir) {
      this.pacman.queueDirection(dir);
    }

    // Update Pac-Man
    this.pacman.update(dt, this.maze);

    // Ghost release timer
    this.ghostReleaseTimer += dt * 1000;
    if (this.ghostReleaseTimer >= GHOST_RELEASE_INTERVAL && this.ghostsReleased < 4) {
      this.ghosts[this.ghostsReleased].release();
      this.ghostsReleased++;
      this.ghostReleaseTimer = 0;
    }

    // Update ghosts
    const blinkyPos = this.ghosts[0].state.position;
    for (const ghost of this.ghosts) {
      const target = getGhostTarget(
        ghost,
        this.pacman.getPosition(),
        this.pacman.state.direction,
        blinkyPos,
      );
      ghost.update(dt, this.maze, target);
    }

    // Check pellet consumption
    const eaten = this.maze.eatPellet(this.pacman.getPosition());
    if (eaten === Tile.PELLET) {
      this.score += POINTS_PELLET;
      audio.playChomp();
    } else if (eaten === Tile.POWER_PELLET) {
      this.score += POINTS_POWER_PELLET;
      this.ghostsEatenCombo = 0;
      for (const ghost of this.ghosts) {
        ghost.frighten();
      }
      audio.playPowerPellet();
    }

    // Check extra life
    if (!this.extraLifeAwarded && this.score >= EXTRA_LIFE_SCORE) {
      this.lives = Math.min(this.lives + 1, MAX_LIVES);
      this.extraLifeAwarded = true;
    }

    // Check ghost collisions
    for (const ghost of this.ghosts) {
      if (ghost.state.isInHouse) continue;

      const dist = Math.abs(ghost.state.position.x - this.pacman.state.position.x)
        + Math.abs(ghost.state.position.y - this.pacman.state.position.y);

      if (dist < 1) {
        if (ghost.state.mode === 'frightened') {
          // Eat ghost
          ghost.eat();
          this.ghostsEatenCombo++;
          this.score += POINTS_GHOST_BASE * Math.pow(2, this.ghostsEatenCombo - 1);
          audio.playEatGhost();
        } else if (ghost.state.mode !== 'eaten') {
          // Pac-Man dies
          this.lives--;
          this.pacman.state.alive = false;
          this.state = 'dying';
          this.stateTimer = 0;
          audio.playDeath();
          return;
        }
      }
    }

    // Check level complete
    if (this.maze.isComplete()) {
      this.state = 'levelcomplete';
      this.stateTimer = 0;
      audio.playLevelComplete();
    }
  }

  /** Render the current frame. */
  private render(): void {
    this.renderer.clear();

    switch (this.state) {
      case 'start':
        this.renderer.renderStartScreen(
          this.highScores,
          this.getThemeLabel(),
          this.themePromptActive,
          this.themePromptText,
          this.themeGenerating,
          this.themeGenerateError,
        );
        break;

      case 'playing':
        this.renderGameplay();
        if (this.showReady) {
          this.renderer.renderReady();
        }
        break;

      case 'dying':
        this.renderGameplay();
        this.renderer.renderDying(
          this.pacman,
          this.stateTimer / DYING_ANIMATION_DURATION,
        );
        break;

      case 'levelcomplete':
        this.renderGameplay();
        this.renderer.renderLevelComplete(this.level);
        break;

      case 'gameover':
        this.renderGameplay();
        this.renderer.renderGameOver(this.score, this.level);
        this.renderer.renderScoreForm(
          this.score,
          this.playerName,
          this.scoreSubmitted,
          this.submitError,
        );
        break;

      case 'paused':
        this.renderGameplay();
        this.ctx_fillPaused();
        break;
    }
  }

  /** Render the active gameplay elements. */
  private renderGameplay(): void {
    this.renderer.renderMaze(this.maze);
    this.renderer.renderHUD(this.score, this.lives, this.level);

    if (this.pacman.state.alive && this.state !== 'dying') {
      this.renderer.renderPacman(this.pacman);
    }

    for (const ghost of this.ghosts) {
      this.renderer.renderGhost(ghost);
    }
  }

  /** Show paused overlay. */
  private ctx_fillPaused(): void {
    // Use a simple overlay handled by renderer
  }

  /** Start a new game from the start screen. */
  private startNewGame(): void {
    // Don't start if AI theme prompt is active
    if (this.themePromptActive || this.themeGenerating) {
      this.input.onAnyInput(() => this.startNewGame());
      return;
    }

    this.score = 0;
    this.lives = STARTING_LIVES;
    this.level = 1;
    this.ghostsEatenCombo = 0;
    this.extraLifeAwarded = false;
    this.nameInputActive = false;

    this.maze.reset();
    this.pacman.respawn();
    this.pacman.setLevel(1);
    this.ghosts = createGhosts();
    this.ghosts.forEach(g => g.setLevel(1));
    this.ghostsReleased = 1;
    this.ghostReleaseTimer = 0;

    this.showReady = true;
    this.readyTimer = READY_MESSAGE_DURATION;
    this.state = 'playing';

    audio.playStart();
  }

  /** Advance to the next level. */
  private nextLevel(): void {
    this.level++;
    this.maze.reset();
    this.resetPositions();
    this.pacman.setLevel(this.level);
    this.ghosts.forEach(g => g.setLevel(this.level));
    this.showReady = true;
    this.readyTimer = READY_MESSAGE_DURATION;
    this.state = 'playing';
  }

  /** Reset entity positions without resetting score/lives. */
  private resetPositions(): void {
    this.pacman.respawn();
    this.ghosts = createGhosts();
    this.ghosts.forEach(g => g.setLevel(this.level));
    this.ghostsReleased = 1;
    this.ghostReleaseTimer = 0;
    this.ghostsEatenCombo = 0;
  }

  /** Bind keyboard events for name input during game-over. */
  private bindNameInput(): void {
    document.addEventListener('keydown', async (e: KeyboardEvent) => {
      // Theme cycling on start screen with T key
      if (this.state === 'start' && (e.key === 't' || e.key === 'T') && !this.nameInputActive && !this.themePromptActive) {
        e.preventDefault();
        e.stopPropagation();
        this.cycleTheme();
        return;
      }

      // AI theme generation prompt on start screen with G key
      if (this.state === 'start' && (e.key === 'g' || e.key === 'G') && !this.nameInputActive && !this.themePromptActive && !this.themeGenerating) {
        e.preventDefault();
        e.stopPropagation();
        this.themePromptActive = true;
        this.themePromptText = '';
        this.themeGenerateError = null;
        return;
      }

      // Handle theme prompt input
      if (this.themePromptActive && !this.themeGenerating) {
        if (e.key === 'Escape') {
          e.preventDefault();
          this.themePromptActive = false;
          this.themePromptText = '';
          this.themeGenerateError = null;
          return;
        }

        if (e.key === 'Enter' && this.themePromptText.trim().length > 0) {
          e.preventDefault();
          this.generateAITheme();
          return;
        }

        if (e.key === 'Backspace') {
          e.preventDefault();
          this.themePromptText = this.themePromptText.slice(0, -1);
          return;
        }

        // Printable characters (max 60 chars)
        if (e.key.length === 1 && this.themePromptText.length < 60) {
          const code = e.key.charCodeAt(0);
          if (code >= 0x20 && code <= 0x7e) {
            e.preventDefault();
            this.themePromptText += e.key;
          }
        }
        return;
      }

      if (!this.nameInputActive) return;

      if (this.scoreSubmitted) {
        // Any key returns to start screen
        this.state = 'start';
        this.nameInputActive = false;
        this.highScores = await fetchLeaderboard();
        this.input.onAnyInput(() => this.startNewGame());
        return;
      }

      if (e.key === 'Enter' && this.playerName.trim().length > 0) {
        e.preventDefault();
        try {
          await submitScore({
            player_name: this.playerName.trim(),
            score: this.score,
            level_reached: this.level,
          });
          this.scoreSubmitted = true;
          this.submitError = null;
        } catch (err) {
          this.submitError = err instanceof Error ? err.message : 'Failed to save score';
        }
        return;
      }

      if (e.key === 'Backspace') {
        e.preventDefault();
        this.playerName = this.playerName.slice(0, -1);
        return;
      }

      if (e.key === 'Escape') {
        // Skip score submission
        this.state = 'start';
        this.nameInputActive = false;
        this.highScores = await fetchLeaderboard();
        this.input.onAnyInput(() => this.startNewGame());
        return;
      }

      // Only printable ASCII (1-10 chars)
      if (e.key.length === 1 && this.playerName.length < 10) {
        const code = e.key.charCodeAt(0);
        if (code >= 0x20 && code <= 0x7e) {
          e.preventDefault();
          this.playerName += e.key;
        }
      }
    });

    // Pause on visibility change
    document.addEventListener('visibilitychange', () => {
      if (document.hidden && this.state === 'playing') {
        this.state = 'paused';
      } else if (!document.hidden && this.state === 'paused') {
        this.state = 'playing';
        this.lastTime = performance.now();
        this.accumulator = 0;
      }
    });
  }

  /** Cycle through available themes (Classic -> theme1 -> theme2 -> ... -> Classic). */
  private cycleTheme(): void {
    if (this.themes.length === 0) return;

    this.selectedThemeIndex++;
    if (this.selectedThemeIndex >= this.themes.length) {
      this.selectedThemeIndex = -1; // Back to classic
    }

    const theme = this.selectedThemeIndex >= 0 ? this.themes[this.selectedThemeIndex] : null;
    this.renderer.setTheme(theme);
  }

  /** Generate a theme via AI from the prompt text. */
  private async generateAITheme(): Promise<void> {
    this.themeGenerating = true;
    this.themeGenerateError = null;
    try {
      const theme = await generateTheme(this.themePromptText.trim());
      this.themes.push(theme);
      this.selectedThemeIndex = this.themes.length - 1;
      this.renderer.setTheme(theme);
      this.themePromptActive = false;
      this.themePromptText = '';
    } catch (err) {
      this.themeGenerateError = err instanceof Error ? err.message : 'Generation failed';
    } finally {
      this.themeGenerating = false;
    }
  }

  /** Get current theme label for display on start screen. */
  private getThemeLabel(): string {
    if (this.selectedThemeIndex < 0 || this.themes.length === 0) {
      return 'Classic';
    }
    return this.themes[this.selectedThemeIndex].name;
  }
}
