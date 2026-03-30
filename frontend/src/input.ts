/**
 * input.ts — Keyboard (ArrowUp/Down/Left/Right, WASD) and mouse click input handler
 * with direction queuing.
 */
import type { Direction, Position } from './types';
import { TILE_SIZE } from './constants';

export type InputCallback = (dir: Direction) => void;
export type ActionCallback = () => void;

export class InputHandler {
  private nextDirection: Direction | null = null;
  private onAnyKey: ActionCallback | null = null;
  private canvas: HTMLCanvasElement;

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    this.bindKeyboard();
    this.bindMouse();
  }

  /** Get and clear the queued direction. */
  consumeDirection(): Direction | null {
    const dir = this.nextDirection;
    this.nextDirection = null;
    return dir;
  }

  /** Peek at the queued direction without consuming it. */
  peekDirection(): Direction | null {
    return this.nextDirection;
  }

  /** Set the queued direction directly. */
  setDirection(dir: Direction): void {
    this.nextDirection = dir;
  }

  /** Register a one-shot callback for any key/click press (used for start screen). */
  onAnyInput(callback: ActionCallback): void {
    this.onAnyKey = callback;
  }

  /** Clear the any-input callback. */
  clearAnyInput(): void {
    this.onAnyKey = null;
  }

  private bindKeyboard(): void {
    document.addEventListener('keydown', (e: KeyboardEvent) => {
      const keyMap: Record<string, Direction> = {
        ArrowUp: 'up',
        ArrowDown: 'down',
        ArrowLeft: 'left',
        ArrowRight: 'right',
        w: 'up',
        s: 'down',
        a: 'left',
        d: 'right',
        W: 'up',
        S: 'down',
        A: 'left',
        D: 'right',
      };

      if (keyMap[e.key]) {
        e.preventDefault();
        this.nextDirection = keyMap[e.key];
      }

      // Fire any-key callback (skip T/G — reserved for theme controls on start screen)
      if (this.onAnyKey && e.key !== 't' && e.key !== 'T' && e.key !== 'g' && e.key !== 'G') {
        const cb = this.onAnyKey;
        this.onAnyKey = null;
        cb();
      }
    });
  }

  private bindMouse(): void {
    this.canvas.addEventListener('click', (e: MouseEvent) => {
      // Fire any-key callback on click too
      if (this.onAnyKey) {
        const cb = this.onAnyKey;
        this.onAnyKey = null;
        cb();
        return;
      }

      // Map click to direction based on angle from canvas center
      const rect = this.canvas.getBoundingClientRect();
      const clickX = e.clientX - rect.left;
      const clickY = e.clientY - rect.top;
      const centerX = rect.width / 2;
      const centerY = rect.height / 2;

      const dx = clickX - centerX;
      const dy = clickY - centerY;

      if (Math.abs(dx) > Math.abs(dy)) {
        this.nextDirection = dx > 0 ? 'right' : 'left';
      } else {
        this.nextDirection = dy > 0 ? 'down' : 'up';
      }
    });
  }

  /** Map click position relative to a Pac-Man position on the canvas. */
  mapClickToDirection(clickX: number, clickY: number, pacmanPos: Position): Direction {
    const pacScreenX = pacmanPos.x * TILE_SIZE + TILE_SIZE / 2;
    const pacScreenY = pacmanPos.y * TILE_SIZE + TILE_SIZE / 2;

    const dx = clickX - pacScreenX;
    const dy = clickY - pacScreenY;

    if (Math.abs(dx) > Math.abs(dy)) {
      return dx > 0 ? 'right' : 'left';
    }
    return dy > 0 ? 'down' : 'up';
  }
}
