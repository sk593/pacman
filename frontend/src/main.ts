/**
 * main.ts — Entry point: create canvas element, initialize game, start loop.
 */
import { Game } from './game';
import { CANVAS_WIDTH, CANVAS_HEIGHT } from './constants';

function init(): void {
  const canvas = document.getElementById('game') as HTMLCanvasElement;
  if (!canvas) {
    throw new Error('Canvas element #game not found');
  }

  canvas.width = CANVAS_WIDTH;
  canvas.height = CANVAS_HEIGHT;

  const ctx = canvas.getContext('2d');
  if (!ctx) {
    throw new Error('Could not get 2D rendering context');
  }

  // Disable image smoothing for pixel-art look
  ctx.imageSmoothingEnabled = false;

  const game = new Game(canvas, ctx);
  game.start();
}

// Initialize when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
