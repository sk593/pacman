/**
 * score-client.ts — HTTP client for the score API.
 * Fetches leaderboard and submits scores with error handling and graceful degradation.
 */
import type { HighScoreEntry, ScoreSubmission } from './types';
import { API_BASE, LEADERBOARD_SIZE } from './constants';

/**
 * Fetch the top scores from the leaderboard.
 * Returns an empty array on failure (graceful degradation).
 */
export async function fetchLeaderboard(): Promise<HighScoreEntry[]> {
  try {
    const res = await fetch(`${API_BASE}/scores`);
    if (!res.ok) {
      console.warn('Failed to fetch leaderboard:', res.status);
      return [];
    }
    const data: HighScoreEntry[] = await res.json();
    return data.slice(0, LEADERBOARD_SIZE);
  } catch (err) {
    console.warn('Leaderboard unavailable:', err);
    return [];
  }
}

/**
 * Submit a new score to the API.
 * Throws on failure so the caller can display an error message.
 */
export async function submitScore(submission: ScoreSubmission): Promise<HighScoreEntry> {
  const res = await fetch(`${API_BASE}/scores`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(submission),
  });

  if (!res.ok) {
    const body = await res.json().catch(() => ({ error: 'Unknown error' }));
    throw new Error(body.error || `HTTP ${res.status}`);
  }

  return res.json();
}
