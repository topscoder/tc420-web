// Communication log that survives reloads (browser storage) and can be exported.
export const LOG_KEY = 'tc420-testlog-v1';

export class Logbook {
  // storage: something with getItem/setItem (localStorage); may be null or throw.
  constructor({ storage = null, key = LOG_KEY, now = () => new Date() } = {}) {
    this.storage = storage;
    this.key = key;
    this.now = now;
    this.listeners = new Set();
    this.storageOk = true;
    this.entries = [];
    try {
      this.entries = JSON.parse(storage?.getItem(key) || '[]');
    } catch {
      this.entries = [];
    }
  }

  onAdd(fn) {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  add(kind, text, test = '', extra = {}) {
    const entry = { t: this.now().toISOString(), kind, test, text, ...extra };
    this.entries.push(entry);
    this.persist();
    this.listeners.forEach((fn) => fn(entry));
    return entry;
  }

  clear() {
    this.entries = [];
    this.persist();
  }

  persist() {
    try {
      this.storage?.setItem(this.key, JSON.stringify(this.entries));
      this.storageOk = !!this.storage;
    } catch {
      this.storageOk = false;
    }
  }

  toJson({ app, version, userAgent }) {
    return JSON.stringify(
      { app, version, exported: this.now().toISOString(), userAgent, entries: this.entries },
      null,
      2,
    );
  }

  toText({ app, version, userAgent }) {
    const lines = this.entries.map((e) => `${e.t}\t${e.kind.toUpperCase()}\t${e.test || '-'}\t${e.text}`);
    return `${app} ${version}\n${userAgent}\n\n${lines.join('\n')}\n`;
  }
}
