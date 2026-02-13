// content-expose - Zero-dependency content management dev tool

// ============================================================================
// Types
// ============================================================================

type ContentValue =
  | string
  | number
  | boolean
  | null
  | ContentValue[]
  | { [key: string]: ContentValue };
type Content = Record<string, ContentValue>;

// ============================================================================
// Constants
// ============================================================================

const STORAGE_KEY = "content-expose-preview";
const OPEN_KEY = "content-expose-open";
const PANEL_ID = "content-expose-devtools";

const TIMING = {
  HYDRATION_DELAY: 500,
} as const;

// ============================================================================
// State
// ============================================================================

interface State {
  rawContent: Content | null;
  initialized: boolean;
  accessedKeys: Set<string>;
  devToolsPanel: HTMLElement | null;
  isOpening: boolean;
}

const state: State = {
  rawContent: null,
  initialized: false,
  accessedKeys: new Set<string>(),
  devToolsPanel: null,
  isOpening: false,
};

// ============================================================================
// Keyboard Handler
// ============================================================================

function handleKeydown(e: KeyboardEvent): void {
  // cmd+e (Mac) or ctrl+e (Windows/Linux)
  if ((e.metaKey || e.ctrlKey) && e.key === "e") {
    e.preventDefault();
    void toggleDevTools();
  }
}

// ============================================================================
// Content Management
// ============================================================================

function getActiveContent(): Content {
  if (!state.rawContent) {
    throw new Error(
      "content-expose: Content not initialized. Call initContentExpose() first."
    );
  }

  // Only use localStorage preview content when devtools is open
  // This prevents SSR hydration mismatch for regular visitors
  if (typeof window !== "undefined" && localStorage.getItem(OPEN_KEY) === "true") {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      try {
        return JSON.parse(stored) as Content;
      } catch {
        // Invalid JSON, fall through to rawContent
      }
    }
  }

  return state.rawContent;
}

function createContentProxy<T extends Content>(): T {
  const handler: ProxyHandler<T> = {
    get(_target, key: string) {
      const active = getActiveContent();
      if (typeof key === "string" && Object.hasOwn(active, key)) {
        state.accessedKeys.add(key);
      }
      return active[key];
    },
    has(_target, key: string) {
      return Object.hasOwn(getActiveContent(), key);
    },
    ownKeys() {
      return Reflect.ownKeys(getActiveContent());
    },
    getOwnPropertyDescriptor(_target, key: string) {
      const active = getActiveContent();
      if (Object.hasOwn(active, key)) {
        return {
          enumerable: true,
          configurable: true,
          value: active[key],
        };
      }
      return undefined;
    },
  };

  return new Proxy({} as T, handler);
}

// ============================================================================
// DevTools Panel Management
// ============================================================================

function getExistingPanel(): HTMLElement | null {
  return document.getElementById(PANEL_ID);
}

function closeDevTools(): void {
  const existing = getExistingPanel();
  if (existing) {
    existing.remove();
  }
  if (state.devToolsPanel) {
    state.devToolsPanel.remove();
  }
  state.devToolsPanel = null;
  localStorage.setItem(OPEN_KEY, "false");

  // Reload to show server content if there's preview content
  if (localStorage.getItem(STORAGE_KEY)) {
    location.reload();
  }
}

async function toggleDevTools(): Promise<void> {
  // Check for existing panel in DOM (handles HMR state loss)
  if (getExistingPanel() || state.devToolsPanel) {
    closeDevTools();
    return;
  }

  await openDevTools();
}

async function openDevTools(): Promise<void> {
  // Clear stale reference if panel not in DOM
  if (state.devToolsPanel && !getExistingPanel()) {
    state.devToolsPanel = null;
  }

  // Prevent duplicate opens
  if (state.isOpening || state.devToolsPanel || getExistingPanel()) {
    return;
  }

  state.isOpening = true;

  try {
    // Check if we need to reload to show preview content
    const hasPreviewContent = Boolean(localStorage.getItem(STORAGE_KEY));
    const wasAlreadyOpen = localStorage.getItem(OPEN_KEY) === "true";

    // If opening for first time with existing preview content, reload to show it
    if (hasPreviewContent && !wasAlreadyOpen) {
      localStorage.setItem(OPEN_KEY, "true");
      location.reload();
      return;
    }

    // Dynamic import to avoid bundling devtools in production builds
    const { createDevToolsPanel } = await import("./devtools");

    // Double-check after async import
    if (state.devToolsPanel || getExistingPanel()) {
      return;
    }

    state.devToolsPanel = createDevToolsPanel(state.rawContent!, closeDevTools);

    document.body.appendChild(state.devToolsPanel);
    localStorage.setItem(OPEN_KEY, "true");
  } finally {
    state.isOpening = false;
  }
}

// ============================================================================
// Public API
// ============================================================================

/**
 * Initialize content and set up keyboard listener.
 * Returns a typed proxy to the content - use this for full type safety.
 *
 * @example
 * // app/content.ts
 * import { initContentExpose } from "content-expose";
 * import rawContent from "../content.json";
 *
 * export const content = initContentExpose(rawContent);
 *
 * // Any component - fully typed!
 * import { content } from "~/content";
 * content.settings.logo.url // ✓ autocomplete works
 */
export function initContentExpose<T extends Content>(raw: T): T {
  state.rawContent = raw;

  if (!state.initialized) {
    state.initialized = true;

    // Set up keyboard listener (client-side only)
    if (typeof window !== "undefined") {
      // Remove any existing listener (handles HMR re-init)
      window.removeEventListener("keydown", handleKeydown);
      window.addEventListener("keydown", handleKeydown);

      // Auto-open if was open before reload
      if (localStorage.getItem(OPEN_KEY) === "true") {
        setTimeout(() => {
          void openDevTools();
        }, TIMING.HYDRATION_DELAY);
      }
    }
  }

  return createContentProxy<T>();
}

/** Get the set of content keys that have been accessed */
export function getAccessedKeys(): Set<string> {
  return state.accessedKeys;
}

// Export storage key for devtools
export { STORAGE_KEY };

/**
 * Pre-initialized content proxy for direct imports.
 * Call initContentExpose() first, then use this anywhere.
 *
 * Type it via module augmentation in a .d.ts file:
 * @example
 * // app/content.d.ts
 * import type _Content from "../content.json";
 * declare module "content-expose" {
 *   export const content: typeof _Content;
 * }
 *
 * // Any component
 * import { content } from "content-expose";
 * content.settings.logo.url // ✓ fully typed!
 */
export const content: Content = createContentProxy<Content>();