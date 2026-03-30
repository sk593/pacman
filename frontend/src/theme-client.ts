/**
 * theme-client.ts — HTTP client for the theme API.
 * Fetches available themes and generates new ones via AI.
 */
import type { Theme } from './types';
import { API_BASE } from './constants';

/**
 * Fetch all available themes.
 * Returns an empty array on failure (graceful degradation).
 */
export async function fetchThemes(): Promise<Theme[]> {
  try {
    const res = await fetch(`${API_BASE}/themes`);
    if (!res.ok) {
      console.warn('Failed to fetch themes:', res.status);
      return [];
    }
    return await res.json();
  } catch (err) {
    console.warn('Themes unavailable:', err);
    return [];
  }
}

/**
 * Fetch a single theme by ID.
 * Returns null on failure.
 */
export async function fetchTheme(id: number): Promise<Theme | null> {
  try {
    const res = await fetch(`${API_BASE}/themes/${id}`);
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

/**
 * Request AI generation of a new theme.
 * Returns the generated theme or throws on failure.
 */
export async function generateTheme(description: string): Promise<Theme> {
  const res = await fetch(`${API_BASE}/themes/generate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ description }),
  });

  if (!res.ok) {
    const body = await res.json().catch(() => ({ error: 'Unknown error' }));
    throw new Error(body.error || `HTTP ${res.status}`);
  }

  return res.json();
}
