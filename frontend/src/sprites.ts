/**
 * sprites.ts — Sprite sheet loader and frame mapping.
 *
 * For MVP, we use canvas-drawn shapes instead of a sprite sheet.
 * This module provides the abstraction layer so a real sprite sheet
 * can be swapped in later without changing game logic.
 */

export interface SpriteFrame {
  x: number;
  y: number;
  width: number;
  height: number;
}

export class SpriteSheet {
  private image: HTMLImageElement | null = null;
  private loaded = false;

  /** Load a sprite sheet image (no-op for MVP — we draw procedurally). */
  async load(_url: string): Promise<void> {
    // MVP: no sprite sheet needed, all rendering is procedural
    this.loaded = true;
    return Promise.resolve();
  }

  /** Check if the sprite sheet is loaded. */
  isLoaded(): boolean {
    return this.loaded;
  }

  /** Get the raw image (null for MVP procedural rendering). */
  getImage(): HTMLImageElement | null {
    return this.image;
  }

  /**
   * Draw a sprite frame to the canvas (no-op for MVP).
   * When a real sprite sheet is added, this will blit from the sheet.
   */
  drawFrame(
    _ctx: CanvasRenderingContext2D,
    _frame: SpriteFrame,
    _dx: number,
    _dy: number,
    _dw: number,
    _dh: number,
  ): void {
    // MVP: all drawing handled by renderer.ts with canvas primitives
  }
}

/** Singleton sprite sheet instance. */
export const sprites = new SpriteSheet();
