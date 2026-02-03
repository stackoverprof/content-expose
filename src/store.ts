// Singleton store for content-expose

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyContent = Record<string, any>;

interface Store {
  rawContent: AnyContent | null;
  accessedKeys: Set<string>;
  initialized: boolean;
  hydrated: boolean; // Only true after client hydration completes
}

const store: Store = {
  rawContent: null,
  accessedKeys: new Set<string>(),
  initialized: false,
  hydrated: false,
};

// Check localStorage for preview content (client-side only, after hydration)
function getActiveContent(): AnyContent {
  if (!store.rawContent) {
    throw new Error(
      "content-expose: Content not initialized. Call initContentExpose() first."
    );
  }

  // Only use preview content AFTER hydration to avoid mismatch
  if (store.hydrated && typeof window !== "undefined") {
    const stored = localStorage.getItem("content-expose-preview");
    if (stored) {
      try {
        return JSON.parse(stored) as AnyContent;
      } catch {
        // Invalid JSON, ignore
      }
    }
  }
  return store.rawContent;
}

// Create proxy that tracks accessed keys
function createContentProxy(): AnyContent {
  const handler: ProxyHandler<AnyContent> = {
    get(target, key: string) {
      // Only track string keys that exist
      if (typeof key === "string" && key in getActiveContent()) {
        store.accessedKeys.add(key);
      }
      return getActiveContent()[key];
    },
  };

  // Use an empty object as the target, actual data comes from getActiveContent()
  return new Proxy({} as AnyContent, handler);
}

// The proxy-wrapped content
export const content: AnyContent = createContentProxy();

// Initialize the store with raw content
export function initContentExpose<T extends AnyContent>(rawContent: T): void {
  if (store.initialized) {
    // Allow re-initialization (useful for HMR)
    store.rawContent = rawContent;
    return;
  }

  store.rawContent = rawContent;
  store.initialized = true;
}

// Mark hydration as complete - call this from useEffect in root component
export function markHydrated(): void {
  store.hydrated = true;
}

// Internal getters for ContentExpose component
export function getRawContent(): AnyContent {
  if (!store.rawContent) {
    throw new Error(
      "content-expose: Content not initialized. Call initContentExpose() first."
    );
  }
  return store.rawContent;
}

export function getAccessedKeys(): Set<string> {
  return store.accessedKeys;
}

export function getActiveContentForComponent(): AnyContent {
  return getActiveContent();
}

export function isHydrated(): boolean {
  return store.hydrated;
}
