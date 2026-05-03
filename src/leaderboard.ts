import { ref, push, query, orderByChild, limitToLast, get } from 'firebase/database';
import { db } from './firebase';

export interface LeaderboardEntry {
  name: string;
  score: number;
  level: number;
  bonusesCollected: number;
  trapsTriggered: number;
  date: string;
}

const LEADERBOARD_PATH = 'leaderboard';

export async function submitScore(entry: Omit<LeaderboardEntry, 'date'>): Promise<void> {
  const leaderboardRef = ref(db, LEADERBOARD_PATH);
  await push(leaderboardRef, {
    ...entry,
    date: new Date().toISOString(),
  });
}

export async function getTopScores(count: number = 20): Promise<LeaderboardEntry[]> {
  const leaderboardRef = ref(db, LEADERBOARD_PATH);
  const topQuery = query(leaderboardRef, orderByChild('score'), limitToLast(count));
  const snapshot = await get(topQuery);
  if (!snapshot.exists()) return [];
  const entries: LeaderboardEntry[] = [];
  snapshot.forEach((child) => {
    entries.push(child.val());
  });
  // Firebase returns ascending by score, we want descending (highest first)
  return entries.reverse();
}
