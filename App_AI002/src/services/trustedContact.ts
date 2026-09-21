export type TrustedContact = { name: string; phone: string };

type StorageLike = {
  getItem: (key: string) => Promise<string | null>;
  setItem: (key: string, value: string) => Promise<void>;
  removeItem: (key: string) => Promise<void>;
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
    if (typeof localStorage !== 'undefined') {
      return {
        getItem: async key => localStorage.getItem(key),
        setItem: async (key, value) => { localStorage.setItem(key, value); },
        removeItem: async key => { localStorage.removeItem(key); },
      };
    }
    return {
      getItem: async key => memoryStorage.get(key) ?? null,
      setItem: async (key, value) => { memoryStorage.set(key, value); },
      removeItem: async key => { memoryStorage.delete(key); },
    };
  }
}

const keyForAccount = (accountKey: string) => `joyfulmind.trusted-contact.${accountKey}`;

export async function loadLocalTrustedContact(accountKey: string): Promise<TrustedContact | null> {
  const raw = await (await getStorage()).getItem(keyForAccount(accountKey));
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as Partial<TrustedContact>;
    return typeof parsed.name === 'string' && typeof parsed.phone === 'string'
      ? { name: parsed.name, phone: parsed.phone }
      : null;
  } catch {
    return null;
  }
}

export async function hasPendingTrustedContactSync(accountKey: string): Promise<boolean> {
  const raw = await (await getStorage()).getItem(keyForAccount(accountKey));
  if (!raw) return false;
  try {
    const parsed = JSON.parse(raw) as { pendingSync?: unknown };
    return parsed.pendingSync === true;
  } catch {
    return false;
  }
}

export async function saveLocalTrustedContact(
  accountKey: string,
  contact: TrustedContact,
  pendingSync = false,
): Promise<void> {
  await (await getStorage()).setItem(keyForAccount(accountKey), JSON.stringify({ ...contact, pendingSync }));
}

export async function deleteLocalTrustedContact(accountKey: string): Promise<void> {
  await (await getStorage()).removeItem(keyForAccount(accountKey));
}
