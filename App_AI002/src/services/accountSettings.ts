import { getApiBaseUrl, isValidApiBaseUrl, setApiBaseUrl } from './api';

type StorageLike = {
  getItem: (key: string) => Promise<string | null>;
  setItem: (key: string, value: string) => Promise<void>;
};

let memoryStorage = new Map<string, string>();
let injectedStorage: StorageLike | null = null;

async function getStorage(): Promise<StorageLike> {
  if (injectedStorage) return injectedStorage;
  try {
    const moduleName = '@react-native-async-storage/async-storage';
    const storageModule = await import(moduleName) as { default: StorageLike };
    injectedStorage = storageModule.default;
    return injectedStorage;
  } catch {
    return {
      getItem: async key => memoryStorage.get(key) ?? null,
      setItem: async (key, value) => { memoryStorage.set(key, value); },
    };
  }
}

const keyForAccount = (accountId: string) => `joyfulmind.settings.${accountId}`;

export async function loadAccountSettings(accountId: string): Promise<{ apiBaseUrl: string }> {
  const storage = await getStorage();
  const raw = await storage.getItem(keyForAccount(accountId));
  if (!raw) return { apiBaseUrl: getApiBaseUrl() };
  try {
    const parsed = JSON.parse(raw) as { apiBaseUrl?: unknown };
    return { apiBaseUrl: typeof parsed.apiBaseUrl === 'string' && isValidApiBaseUrl(parsed.apiBaseUrl)
      ? parsed.apiBaseUrl
      : getApiBaseUrl() };
  } catch {
    return { apiBaseUrl: getApiBaseUrl() };
  }
}

export async function saveAccountSettings(accountId: string, settings: { apiBaseUrl: string }): Promise<void> {
  const storage = await getStorage();
  await storage.setItem(keyForAccount(accountId), JSON.stringify(settings));
}

export async function activateAccountSettings(accountId: string): Promise<string> {
  const settings = await loadAccountSettings(accountId);
  setApiBaseUrl(settings.apiBaseUrl);
  return getApiBaseUrl();
}
