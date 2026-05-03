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
const LOCAL_KEY = 'memoryGameRecords';

export async function submitScore(entry: Omit<LeaderboardEntry, 'date'>): Promise<void> {
  const record = { ...entry, date: new Date().toISOString() };

  // Always save to localStorage as backup
  const records = JSON.parse(localStorage.getItem(LOCAL_KEY) || '[]');
  records.push(record);
  records.sort((a: { score: number }, b: { score: number }) => b.score - a.score);
  localStorage.setItem(LOCAL_KEY, JSON.stringify(records.slice(0, 100)));

  // Try Firebase
  try {
    const leaderboardRef = ref(db, LEADERBOARD_PATH);
    await push(leaderboardRef, record);
  } catch (err) {
    console.warn('[LEADERBOARD] Firebase write failed, saved to localStorage only:', err);
  }
}

export async function getTopScores(count: number = 20): Promise<LeaderboardEntry[]> {
  let firebaseEntries: LeaderboardEntry[] = [];

  // Try Firebase first
  try {
    const leaderboardRef = ref(db, LEADERBOARD_PATH);
    const topQuery = query(leaderboardRef, orderByChild('score'), limitToLast(count));
    const snapshot = await get(topQuery);
    if (snapshot.exists()) {
      snapshot.forEach((child) => {
        firebaseEntries.push(child.val());
      });
      firebaseEntries.reverse();
    }
  } catch (err) {
    console.warn('[LEADERBOARD] Firebase read failed, using localStorage:', err);
  }

  // Merge with localStorage entries
  const localRecords: LeaderboardEntry[] = JSON.parse(localStorage.getItem(LOCAL_KEY) || '[]');

  // Combine, deduplicate by name+score+date, sort by score desc, take top N
  const all = [...firebaseEntries, ...localRecords];
  const seen = new Set<string>();
  const unique = all.filter(e => {
    const key = `${e.name}|${e.score}|${e.date}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
  unique.sort((a, b) => b.score - a.score);
  return unique.slice(0, count);
}
