// content-expose - Zero-dependency content management dev tool

const STORAGE_KEY = "content-expose-preview";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyContent = Record<string, any>;

// Module singleton
let rawContent: AnyContent | null = null;
let initialized = false;

// Check localStorage for preview content (client-side only)
function getActiveContent(): AnyContent {
  if (!rawContent) {
    throw new Error(
      "content-expose: Content not initialized. Call initContentExpose() first."
    );
  }

  // Client-side: check localStorage first
  if (typeof window !== "undefined") {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      try {
        return JSON.parse(stored) as AnyContent;
      } catch {
        // Invalid JSON, fall through to rawContent
      }
    }
  }

  return rawContent;
}

// Create proxy that returns active content values
function createContentProxy(): AnyContent {
  const handler: ProxyHandler<AnyContent> = {
    get(_target, key: string) {
      const active = getActiveContent();
      return active[key];
    },
    has(_target, key: string) {
      const active = getActiveContent();
      return key in active;
    },
    ownKeys() {
      const active = getActiveContent();
      return Reflect.ownKeys(active);
    },
    getOwnPropertyDescriptor(_target, key: string) {
      const active = getActiveContent();
      if (key in active) {
        return {
          enumerable: true,
          configurable: true,
          value: active[key],
        };
      }
      return undefined;
    },
  };

  return new Proxy({} as AnyContent, handler);
}

// The proxy-wrapped content - always reads from localStorage if available
export const content: AnyContent = createContentProxy();

// Initialize content and set up keyboard listener
export function initContentExpose<T extends AnyContent>(raw: T): void {
  rawContent = raw;

  if (initialized) {
    return;
  }
  initialized = true;

  // Set up keyboard listener (client-side only)
  if (typeof window !== "undefined") {
    window.addEventListener("keydown", (e) => {
      // cmd+e (Mac) or ctrl+e (Windows/Linux)
      if ((e.metaKey || e.ctrlKey) && e.key === "e") {
        e.preventDefault();
        toggleDevTools();
      }
    });
  }
}

// DevTools panel management
let devToolsPanel: HTMLElement | null = null;

async function toggleDevTools(): Promise<void> {
  if (devToolsPanel) {
    devToolsPanel.remove();
    devToolsPanel = null;
    return;
  }

  // Dynamic import to avoid bundling devtools in production builds
  const { createDevToolsPanel } = await import("./devtools");
  devToolsPanel = createDevToolsPanel(rawContent!, () => {
    devToolsPanel = null;
  });
  document.body.appendChild(devToolsPanel);
}

// Export storage key for devtools
export { STORAGE_KEY };
