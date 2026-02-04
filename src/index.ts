// content-expose - Zero-dependency content management dev tool

const STORAGE_KEY = "content-expose-preview";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyContent = Record<string, any>;

// Module singleton
let rawContent: AnyContent | null = null;
let initialized = false;
const accessedKeys = new Set<string>();

const OPEN_KEY = "content-expose-open";

// Keyboard handler (module-level for proper cleanup)
function handleKeydown(e: KeyboardEvent): void {
  // cmd+e (Mac) or ctrl+e (Windows/Linux)
  if ((e.metaKey || e.ctrlKey) && e.key === "e") {
    e.preventDefault();
    toggleDevTools();
  }
}

// Check localStorage for preview content (client-side only)
function getActiveContent(): AnyContent {
  if (!rawContent) {
    throw new Error(
      "content-expose: Content not initialized. Call initContentExpose() first."
    );
  }

  // Client-side: check localStorage first
  // Note: This may cause hydration mismatch warnings if preview content differs from server content.
  // This is acceptable for a dev tool - the warning is harmless and preview works immediately.
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

// Create proxy that returns active content values and tracks access
function createContentProxy(): AnyContent {
  const handler: ProxyHandler<AnyContent> = {
    get(_target, key: string) {
      const active = getActiveContent();
      // Track accessed keys
      if (typeof key === "string" && key in active) {
        accessedKeys.add(key);
      }
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
    // Remove any existing listener (handles HMR re-init)
    window.removeEventListener("keydown", handleKeydown);
    window.addEventListener("keydown", handleKeydown);

    // Auto-open if was open before reload (delay until after React hydration settles)
    if (localStorage.getItem(OPEN_KEY) === "true") {
      setTimeout(() => {
        openDevTools();
      }, 500);
    }
  }
}

// DevTools panel management
const PANEL_ID = "content-expose-devtools";
let devToolsPanel: HTMLElement | null = null;
let isOpening = false;

function getExistingPanel(): HTMLElement | null {
  return document.getElementById(PANEL_ID);
}

async function toggleDevTools(): Promise<void> {
  // Check for existing panel in DOM (handles HMR state loss)
  const existing = getExistingPanel();
  if (existing) {
    existing.remove();
    devToolsPanel = null;
    localStorage.setItem(OPEN_KEY, "false");
    return;
  }

  if (devToolsPanel) {
    devToolsPanel.remove();
    devToolsPanel = null;
    localStorage.setItem(OPEN_KEY, "false");
    return;
  }

  await openDevTools();
}

async function openDevTools(): Promise<void> {
  // If we have a reference but panel is not in DOM, clear the stale reference
  if (devToolsPanel && !getExistingPanel()) {
    devToolsPanel = null;
  }

  // Prevent duplicate opens
  if (isOpening || devToolsPanel || getExistingPanel()) return;
  isOpening = true;

  try {
    // Dynamic import to avoid bundling devtools in production builds
    const { createDevToolsPanel } = await import("./devtools");

    // Double-check after async import
    if (devToolsPanel || getExistingPanel()) {
      return;
    }

    devToolsPanel = createDevToolsPanel(rawContent!, () => {
      devToolsPanel = null;
      localStorage.setItem(OPEN_KEY, "false");
    });
    document.body.appendChild(devToolsPanel);
    localStorage.setItem(OPEN_KEY, "true");
  } finally {
    isOpening = false;
  }
}

// Export storage key and accessed keys for devtools
export { STORAGE_KEY };

export function getAccessedKeys(): Set<string> {
  return accessedKeys;
}

// Deprecated: No longer needed. Kept for backwards compatibility.
export function markHydrated(): void {
  // No-op - preview now works immediately without hydration management
}
