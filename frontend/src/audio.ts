/**
 * audio.ts — Stub module (no-op exports for future sound hooks).
 *
 * Sound is explicitly out of scope for MVP per the spec clarification.
 * This module provides the interface so game logic can call audio
 * functions without conditional checks.
 */

export function playStart(): void {
  // No-op: future sound hook
}

export function playChomp(): void {
  // No-op: future sound hook
}

export function playPowerPellet(): void {
  // No-op: future sound hook
}

export function playEatGhost(): void {
  // No-op: future sound hook
}

export function playDeath(): void {
  // No-op: future sound hook
}

export function playGameOver(): void {
  // No-op: future sound hook
}

export function playLevelComplete(): void {
  // No-op: future sound hook
}

export function stopAll(): void {
  // No-op: future sound hook
}
