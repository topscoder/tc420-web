// Where the program library is kept: IndexedDB when possible, otherwise
// localStorage, otherwise memory only (nothing survives a reload; the UI warns).
const DB_NAME = 'tc420-web';
const STORE = 'state';
const KEY = 'library';
const LS_KEY = 'tc420-web-library';

function request(req) {
  return new Promise((resolve, reject) => {
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function openDb(indexedDB) {
  const req = indexedDB.open(DB_NAME, 1);
  req.onupgradeneeded = () => req.result.createObjectStore(STORE);
  return request(req);
}

export async function indexedDbBackend(indexedDB = globalThis.indexedDB) {
  if (!indexedDB) throw new Error('IndexedDB not available');
  const db = await openDb(indexedDB);
  // Let another tab upgrade or delete the database instead of waiting for this one forever.
  db.onversionchange = () => db.close();
  const tx = (mode) => db.transaction(STORE, mode).objectStore(STORE);
  return {
    kind: 'indexeddb',
    load: () => request(tx('readonly').get(KEY)).then((v) => v ?? null),
    save: (state) => request(tx('readwrite').put(state, KEY)).then(() => undefined),
  };
}

export function localStorageBackend(storage = globalThis.localStorage) {
  if (!storage) throw new Error('localStorage not available');
  storage.getItem(LS_KEY); // throws when blocked
  return {
    kind: 'localstorage',
    load: async () => JSON.parse(storage.getItem(LS_KEY) || 'null'),
    save: async (state) => storage.setItem(LS_KEY, JSON.stringify(state)),
  };
}

export function memoryBackend(initial = null) {
  let value = initial;
  return {
    kind: 'memory',
    load: async () => (value === null ? null : structuredClone(value)),
    save: async (state) => {
      value = structuredClone(state);
    },
  };
}

export async function createBackend() {
  try {
    return await indexedDbBackend();
  } catch {
    try {
      return localStorageBackend();
    } catch {
      return memoryBackend();
    }
  }
}
