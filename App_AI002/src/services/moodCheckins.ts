export type ExerciseRecommendationId = 'breathing' | 'music' | 'dance';

export type MoodCheckin = {
  readonly id: string;
  readonly moodId: string;
  readonly moodLabel: string;
  readonly stressValue: number;
  readonly recordedAt: string;
  readonly recommendedExerciseId: ExerciseRecommendationId;
};

const MAX_CHECKINS = 20;
type StorageLike = {
  getItem: (key: string) => Promise<string | null>;
  setItem: (key: string, value: string) => Promise<void>;
  removeItem: (key: string) => Promise<void>;
};

let memoryStorage = new Map<string, string>();
let resolvedStorage: StorageLike | null = null;

async function getStorage(): Promise<StorageLike> {
  if (resolvedStorage) return resolvedStorage;

  try {
    // Keep this as a runtime import so Metro can still bundle web builds where
    // native dependencies may not have been installed yet.
    const moduleName = '@react-native-async-storage/async-storage';
    const module = await import(moduleName) as { default?: StorageLike };
    if (module.default) {
      resolvedStorage = module.default;
      return resolvedStorage;
    }
  } catch {
    // The browser storage fallback below keeps Web usable without AsyncStorage.
  }

  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      const browserStorage: StorageLike = {
        getItem: async (key) => window.localStorage.getItem(key),
        setItem: async (key, value) => { window.localStorage.setItem(key, value); },
        removeItem: async (key) => { window.localStorage.removeItem(key); },
      };
      resolvedStorage = browserStorage;
      return browserStorage;
    }
  } catch {
    // Some browser privacy settings can disable localStorage.
  }

  const fallbackStorage: StorageLike = {
    getItem: async (key) => memoryStorage.get(key) ?? null,
    setItem: async (key, value) => { memoryStorage.set(key, value); },
    removeItem: async (key) => { memoryStorage.delete(key); },
  };
  resolvedStorage = fallbackStorage;
  return fallbackStorage;
}

function storageKey(accountKey?: string): string {
  return `joyfulmind:mood-checkins:${encodeURIComponent(accountKey || 'guest')}`;
}

function isMoodCheckin(value: unknown): value is MoodCheckin {
  if (!value || typeof value !== 'object') return false;
  const item = value as Partial<MoodCheckin>;
  return typeof item.id === 'string' &&
    typeof item.moodId === 'string' &&
    typeof item.moodLabel === 'string' &&
    Number.isInteger(item.stressValue) &&
    (item.stressValue ?? -1) >= 0 && (item.stressValue ?? 101) <= 100 &&
    typeof item.recordedAt === 'string' && !Number.isNaN(Date.parse(item.recordedAt)) &&
    (item.recommendedExerciseId === 'breathing' ||
      item.recommendedExerciseId === 'music' ||
      item.recommendedExerciseId === 'dance');
}

export async function loadMoodCheckins(accountKey?: string): Promise<MoodCheckin[]> {
  const storage = await getStorage();
  const stored = await storage.getItem(storageKey(accountKey));
  if (!stored) return [];

  try {
    const parsed: unknown = JSON.parse(stored);
    return Array.isArray(parsed)
      ? parsed.filter(isMoodCheckin).slice(0, MAX_CHECKINS)
      : [];
  } catch {
    return [];
  }
}

export async function saveMoodCheckin(
  accountKey: string | undefined,
  entry: MoodCheckin,
): Promise<MoodCheckin[]> {
  const current = await loadMoodCheckins(accountKey);
  const updated = [entry, ...current.filter((item) => item.id !== entry.id)]
    .slice(0, MAX_CHECKINS);
  const storage = await getStorage();
  await storage.setItem(storageKey(accountKey), JSON.stringify(updated));
  return updated;
}

export async function clearMoodCheckins(accountKey?: string): Promise<void> {
  const storage = await getStorage();
  await storage.removeItem(storageKey(accountKey));
}

export function recommendExercise(
  moodId: string,
  stressValue: number,
): ExerciseRecommendationId {
  if (moodId === 'overloaded' || stressValue >= 60) return 'breathing';
  if (moodId === 'sleepy') return 'music';
  if (moodId === 'great' && stressValue < 40) return 'dance';
  return 'music';
}
