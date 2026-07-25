import type { StateStorage } from "zustand/middleware";

type RuntimeProcess = {
  env?: Record<string, string | undefined>;
};

const runtimeProcess = globalThis as unknown as { process?: RuntimeProcess };
const memoryStorage = new Map<string, string>();

export function createFileStorage(prefix = "snapquote"): StateStorage<Promise<void>> {
  return {
    async getItem(name) {
      if (useMemoryStorage()) {
        return memoryStorage.get(storageKey(prefix, name)) ?? null;
      }

      try {
        const file = await storageFile(prefix, name);

        if (!file.exists) {
          return null;
        }

        return await file.text();
      } catch {
        void removeStorageFile(prefix, name);
        return null;
      }
    },

    async setItem(name, value) {
      if (useMemoryStorage()) {
        memoryStorage.set(storageKey(prefix, name), value);
        return;
      }

      const file = await storageFile(prefix, name);

      if (!file.exists) {
        file.create({ intermediates: true, overwrite: true });
      }

      file.write(value);
    },

    async removeItem(name) {
      if (useMemoryStorage()) {
        memoryStorage.delete(storageKey(prefix, name));
        return;
      }

      await removeStorageFile(prefix, name);
    },
  };
}

async function storageFile(prefix: string, name: string) {
  const { File, Paths } = await import("expo-file-system");
  return new File(Paths.document, `${prefix}-${safeStorageName(name)}.json`);
}

async function removeStorageFile(prefix: string, name: string) {
  try {
    const file = await storageFile(prefix, name);

    if (file.exists) {
      file.delete();
    }
  } catch {
    // Best effort cleanup. A failed remove should not break app state.
  }
}

function safeStorageName(name: string) {
  return name.replace(/[^a-z0-9._-]+/gi, "-").replace(/^-+|-+$/g, "") || "state";
}

function storageKey(prefix: string, name: string) {
  return `${prefix}:${name}`;
}

function useMemoryStorage() {
  return runtimeProcess.process?.env?.["VITEST"] === "true" || runtimeProcess.process?.env?.["NODE_ENV"] === "test";
}
