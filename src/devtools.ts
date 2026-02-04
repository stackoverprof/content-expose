// Vanilla JS DevTools Panel - no dependencies

import { STORAGE_KEY, getAccessedKeys } from "./index";

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

type ResizeDirection = "n" | "s" | "e" | "w" | "ne" | "nw" | "se" | "sw";

interface Bounds {
  x: number;
  y: number;
  width: number;
  height: number;
}

interface DragState {
  isDragging: boolean;
  startX: number;
  startY: number;
  startBoundsX: number;
  startBoundsY: number;
}

interface ResizeState {
  direction: ResizeDirection | null;
  startX: number;
  startY: number;
  startBounds: Bounds;
}

// ============================================================================
// Constants
// ============================================================================

const STORAGE_KEYS = {
  BOUNDS: "content-expose-bounds",
  TAB: "content-expose-tab",
  SCROLL: "content-expose-scroll",
} as const;

const PANEL_ID = "content-expose-devtools";

const DEFAULT_BOUNDS: Bounds = { x: 20, y: 20, width: 400, height: 450 };
const MIN_WIDTH = 300;
const MIN_HEIGHT = 250;

const Z_INDEX = {
  PANEL: 999999,
  RESIZE_HANDLE: 10,
  RESIZE_CORNER: 11,
} as const;

const TIMING = {
  MESSAGE_DURATION: 3000,
} as const;

const COLORS = {
  // Panel
  PANEL_BG: "#1e1e1e",
  PANEL_BORDER: "#333",
  HEADER_BG: "#323233",
  TABS_BG: "#252526",

  // Text
  TEXT_PRIMARY: "#d4d4d4",
  TEXT_SECONDARY: "#888",
  TEXT_MUTED: "#666",
  TEXT_WHITE: "#fff",

  // JSON syntax
  JSON_KEY: "#79c0ff",
  JSON_STRING: "#a5d6ff",
  JSON_KEYWORD: "#ff7b72",
  JSON_PUNCTUATION: "#6e7681",

  // Buttons
  BTN_PRIMARY: "#0e639c",
  BTN_PRIMARY_HOVER: "#1177bb",
  BTN_SECONDARY: "#333",
  BTN_SECONDARY_HOVER: "#444",

  // Status
  SUCCESS: "#2ea043",
  ERROR: "#da3633",
  WARNING: "#eab308",
} as const;

// ============================================================================
// Utilities
// ============================================================================

function escapeHtml(str: string): string {
  return str.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function addHoverEffect(
  el: HTMLElement,
  hover: Partial<CSSStyleDeclaration>,
  normal: Partial<CSSStyleDeclaration>,
  signal?: AbortSignal
): void {
  el.addEventListener("mouseenter", () => Object.assign(el.style, hover), { signal });
  el.addEventListener("mouseleave", () => Object.assign(el.style, normal), { signal });
}

function getStoredBounds(): Bounds {
  const stored = localStorage.getItem(STORAGE_KEYS.BOUNDS);
  if (stored) {
    try {
      return { ...DEFAULT_BOUNDS, ...JSON.parse(stored) };
    } catch {
      return DEFAULT_BOUNDS;
    }
  }
  return DEFAULT_BOUNDS;
}

function createStyledElement<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  styles: string,
  attributes?: Record<string, string>
): HTMLElementTagNameMap[K] {
  const el = document.createElement(tag);
  el.style.cssText = styles;
  if (attributes) {
    for (const [key, value] of Object.entries(attributes)) {
      el.setAttribute(key, value);
    }
  }
  return el;
}

// ============================================================================
// JSON Syntax Highlighter
// ============================================================================

function highlightJson(code: string): string {
  const parts: string[] = [];
  let i = 0;

  while (i < code.length) {
    const char = code[i];

    // Whitespace
    if (/\s/.test(char)) {
      parts.push(char);
      i++;
      continue;
    }

    // String
    if (char === '"') {
      let str = '"';
      i++;
      while (i < code.length && code[i] !== '"') {
        if (code[i] === "\\" && i + 1 < code.length) {
          str += code[i] + code[i + 1];
          i += 2;
        } else {
          str += code[i];
          i++;
        }
      }
      str += '"';
      i++;

      // Check if it's a key (followed by :)
      let j = i;
      while (j < code.length && /\s/.test(code[j])) j++;
      const color = code[j] === ":" ? COLORS.JSON_KEY : COLORS.JSON_STRING;
      parts.push(`<span style="color:${color}">${escapeHtml(str)}</span>`);
      continue;
    }

    // Number
    if (/[-\d]/.test(char)) {
      let num = "";
      while (i < code.length && /[\d.eE+-]/.test(code[i])) {
        num += code[i];
        i++;
      }
      parts.push(`<span style="color:${COLORS.JSON_STRING}">${num}</span>`);
      continue;
    }

    // Boolean / null
    if (code.slice(i, i + 4) === "true") {
      parts.push(`<span style="color:${COLORS.JSON_KEYWORD}">true</span>`);
      i += 4;
      continue;
    }
    if (code.slice(i, i + 5) === "false") {
      parts.push(`<span style="color:${COLORS.JSON_KEYWORD}">false</span>`);
      i += 5;
      continue;
    }
    if (code.slice(i, i + 4) === "null") {
      parts.push(`<span style="color:${COLORS.JSON_KEYWORD}">null</span>`);
      i += 4;
      continue;
    }

    // Punctuation
    if (/[{}\[\]:,]/.test(char)) {
      parts.push(`<span style="color:${COLORS.JSON_PUNCTUATION}">${char}</span>`);
      i++;
      continue;
    }

    // Unrecognized characters
    parts.push(`<span style="color:${COLORS.JSON_PUNCTUATION}">${escapeHtml(char)}</span>`);
    i++;
  }

  return parts.join("");
}

// ============================================================================
// Styles
// ============================================================================

const styles = {
  panel: `
    position: fixed;
    background: ${COLORS.PANEL_BG};
    border-radius: 8px;
    box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.5), 0 0 0 1px rgba(255, 255, 255, 0.1);
    border: 1px solid ${COLORS.PANEL_BORDER};
    z-index: ${Z_INDEX.PANEL};
    display: flex;
    flex-direction: column;
    font-family: ui-monospace, monospace;
    color: ${COLORS.TEXT_PRIMARY};
    overflow: hidden;
  `,
  header: `
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 4px 8px;
    border-bottom: 1px solid ${COLORS.PANEL_BORDER};
    background: ${COLORS.HEADER_BG};
    cursor: move;
    user-select: none;
    flex-shrink: 0;
  `,
  title: `
    font-size: 10px;
    color: ${COLORS.TEXT_SECONDARY};
    margin: 0;
  `,
  headerButtons: `
    display: flex;
    align-items: center;
    gap: 4px;
  `,
  iconBtn: `
    display: flex;
    align-items: center;
    gap: 4px;
    padding: 2px 6px;
    border-radius: 4px;
    background: transparent;
    color: ${COLORS.TEXT_SECONDARY};
    font-size: 10px;
    font-family: ui-monospace, monospace;
    border: none;
    cursor: pointer;
  `,
  closeBtn: `
    width: 20px;
    height: 20px;
    display: flex;
    align-items: center;
    justify-content: center;
    border-radius: 4px;
    background: transparent;
    color: ${COLORS.TEXT_MUTED};
    border: none;
    cursor: pointer;
    font-size: 14px;
  `,
  tabsContainer: `
    display: flex;
    background: ${COLORS.TABS_BG};
    border-bottom: 1px solid ${COLORS.PANEL_BORDER};
    overflow-x: auto;
    overflow-y: hidden;
    flex-shrink: 0;
  `,
  tab: `
    padding: 4px 12px;
    font-size: 10px;
    font-family: ui-monospace, monospace;
    border: none;
    border-right: 1px solid ${COLORS.PANEL_BORDER};
    white-space: nowrap;
    cursor: pointer;
    flex-shrink: 0;
  `,
  tabActive: `background: ${COLORS.PANEL_BG}; color: ${COLORS.TEXT_WHITE};`,
  tabInactive: `background: transparent; color: ${COLORS.TEXT_SECONDARY};`,
  editorContainer: `
    flex: 1;
    overflow: auto;
    position: relative;
    min-height: 0;
  `,
  editorWrapper: `
    position: relative;
    min-height: 100%;
    font-family: ui-monospace, monospace;
    font-size: 11px;
    line-height: 1.5;
  `,
  editorHighlight: `
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    padding: 8px;
    pointer-events: none;
    white-space: pre-wrap;
    word-wrap: break-word;
    color: transparent;
  `,
  textarea: `
    position: relative;
    width: 100%;
    min-height: 100%;
    padding: 8px;
    margin: 0;
    border: none;
    outline: none;
    resize: none;
    font-family: inherit;
    font-size: inherit;
    line-height: inherit;
    background: transparent;
    color: transparent;
    caret-color: white;
    white-space: pre-wrap;
    word-wrap: break-word;
    overflow: hidden;
  `,
  buttonBar: `
    display: flex;
    gap: 4px;
    padding: 4px;
    border-top: 1px solid ${COLORS.PANEL_BORDER};
    background: ${COLORS.TABS_BG};
    flex-shrink: 0;
  `,
  primaryBtn: `
    flex: 1;
    padding: 4px 8px;
    font-size: 10px;
    font-family: ui-monospace, monospace;
    background: ${COLORS.BTN_PRIMARY};
    color: white;
    border-radius: 4px;
    border: none;
    cursor: pointer;
  `,
  secondaryBtn: `
    flex: 1;
    padding: 4px 8px;
    font-size: 10px;
    font-family: ui-monospace, monospace;
    background: ${COLORS.BTN_SECONDARY};
    color: #ccc;
    border-radius: 4px;
    border: none;
    cursor: pointer;
  `,
  message: `
    padding: 4px 8px;
    font-size: 10px;
    font-family: ui-monospace, monospace;
    text-align: center;
    flex-shrink: 0;
  `,
} as const;

const RESIZE_DIRECTIONS: ResizeDirection[] = ["n", "s", "e", "w", "ne", "nw", "se", "sw"];

function getResizeHandleStyle(dir: ResizeDirection): string {
  const base = "position: absolute;";
  const zIndex = dir.length === 2 ? Z_INDEX.RESIZE_CORNER : Z_INDEX.RESIZE_HANDLE;

  const dirStyles: Record<ResizeDirection, string> = {
    n: `top: 0; left: 12px; right: 12px; height: 6px; cursor: ns-resize;`,
    s: `bottom: 0; left: 12px; right: 12px; height: 6px; cursor: ns-resize;`,
    e: `right: 0; top: 12px; bottom: 12px; width: 6px; cursor: ew-resize;`,
    w: `left: 0; top: 12px; bottom: 12px; width: 6px; cursor: ew-resize;`,
    ne: `top: 0; right: 0; width: 14px; height: 14px; cursor: nesw-resize;`,
    nw: `top: 0; left: 0; width: 14px; height: 14px; cursor: nwse-resize;`,
    se: `bottom: 0; right: 0; width: 14px; height: 14px; cursor: nwse-resize;`,
    sw: `bottom: 0; left: 0; width: 14px; height: 14px; cursor: nesw-resize;`,
  };

  return `${base} ${dirStyles[dir]} z-index: ${zIndex};`;
}

// ============================================================================
// Component Builders
// ============================================================================

function createHeader(
  hasPreview: boolean,
  onExport: () => void,
  onClose: () => void,
  signal: AbortSignal
): HTMLElement {
  const header = createStyledElement("div", styles.header);

  const title = createStyledElement("span", styles.title);
  title.innerHTML = hasPreview
    ? `Content Expose <span style="color:${COLORS.WARNING}">*</span>`
    : "Content Expose";

  const buttons = createStyledElement("div", styles.headerButtons);

  // Export button
  const exportBtn = createStyledElement("button", styles.iconBtn, {
    "aria-label": "Export JSON to clipboard",
  });
  exportBtn.innerHTML = `<svg style="width:12px;height:12px" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"/></svg> Export`;
  exportBtn.addEventListener("click", onExport, { signal });
  addHoverEffect(
    exportBtn,
    { background: COLORS.BTN_SECONDARY_HOVER, color: "#ccc" },
    { background: "transparent", color: COLORS.TEXT_SECONDARY },
    signal
  );

  // Close button
  const closeBtn = createStyledElement("button", styles.closeBtn, {
    "aria-label": "Close panel",
  });
  closeBtn.textContent = "✕";
  closeBtn.addEventListener("click", onClose, { signal });
  addHoverEffect(
    closeBtn,
    { background: COLORS.BTN_SECONDARY_HOVER, color: "#ccc" },
    { background: "transparent", color: COLORS.TEXT_MUTED },
    signal
  );

  buttons.append(exportBtn, closeBtn);
  header.append(title, buttons);

  return header;
}

function createTabs(
  tabKeys: string[],
  activeTab: string,
  onTabChange: (key: string) => void,
  signal: AbortSignal
): { container: HTMLElement; updateStyles: (active: string) => void } {
  const container = createStyledElement("div", styles.tabsContainer);
  container.className = "ce-tabs";
  container.setAttribute("role", "tablist");

  const buttons: HTMLButtonElement[] = [];

  for (const key of tabKeys) {
    const btn = createStyledElement("button", styles.tab + styles.tabInactive, {
      role: "tab",
      "aria-selected": key === activeTab ? "true" : "false",
    });
    btn.textContent = key;
    btn.addEventListener("click", () => onTabChange(key), { signal });
    addHoverEffect(
      btn,
      { background: "#2d2d2d" },
      { background: "transparent" },
      signal
    );
    buttons.push(btn);
    container.appendChild(btn);
  }

  function updateStyles(active: string): void {
    for (let i = 0; i < buttons.length; i++) {
      const key = tabKeys[i];
      const isActive = key === active;
      buttons[i].style.cssText = styles.tab + (isActive ? styles.tabActive : styles.tabInactive);
      buttons[i].setAttribute("aria-selected", isActive ? "true" : "false");
    }
  }

  updateStyles(activeTab);

  return { container, updateStyles };
}

function createEditor(
  initialContent: string,
  panel: HTMLElement,
  onScroll: (scrollTop: number) => void
): {
  container: HTMLElement;
  textarea: HTMLTextAreaElement;
  updateHighlight: () => void;
  getValue: () => string;
  setValue: (value: string) => void;
} {
  const container = createStyledElement("div", styles.editorContainer);
  const wrapper = createStyledElement("div", styles.editorWrapper);
  const highlight = createStyledElement("div", styles.editorHighlight);
  const textarea = createStyledElement("textarea", styles.textarea) as HTMLTextAreaElement;

  textarea.value = initialContent;
  textarea.spellcheck = false;
  textarea.setAttribute("aria-label", "JSON editor");

  function updateHighlight(): void {
    highlight.innerHTML = highlightJson(textarea.value);
    if (panel.isConnected) {
      textarea.style.height = "auto";
      textarea.style.height = `${textarea.scrollHeight}px`;
    }
  }

  textarea.addEventListener("input", updateHighlight);
  textarea.addEventListener("scroll", () => {
    highlight.scrollTop = textarea.scrollTop;
    highlight.scrollLeft = textarea.scrollLeft;
    onScroll(container.scrollTop);
  });

  // Initial highlight without height calc
  highlight.innerHTML = highlightJson(textarea.value);

  wrapper.append(highlight, textarea);
  container.appendChild(wrapper);

  // Resize after mount
  setTimeout(() => {
    if (panel.isConnected) {
      textarea.style.height = "auto";
      textarea.style.height = `${textarea.scrollHeight}px`;
    }
  }, 0);

  return {
    container,
    textarea,
    updateHighlight,
    getValue: () => textarea.value,
    setValue: (value: string) => {
      textarea.value = value;
      updateHighlight();
    },
  };
}

function createButtonBar(
  hasPreview: boolean,
  onPreview: () => void,
  onReset: () => void,
  signal: AbortSignal
): HTMLElement {
  const bar = createStyledElement("div", styles.buttonBar);

  const previewBtn = createStyledElement("button", styles.primaryBtn);
  previewBtn.textContent = "Preview";
  previewBtn.addEventListener("click", onPreview, { signal });
  addHoverEffect(
    previewBtn,
    { background: COLORS.BTN_PRIMARY_HOVER },
    { background: COLORS.BTN_PRIMARY },
    signal
  );

  bar.appendChild(previewBtn);

  if (hasPreview) {
    const resetBtn = createStyledElement("button", styles.secondaryBtn);
    resetBtn.textContent = "Reset";
    resetBtn.addEventListener("click", onReset, { signal });
    addHoverEffect(
      resetBtn,
      { background: COLORS.BTN_SECONDARY_HOVER },
      { background: COLORS.BTN_SECONDARY },
      signal
    );
    bar.appendChild(resetBtn);
  }

  return bar;
}

// ============================================================================
// Drag & Resize Behaviors
// ============================================================================

function setupDragBehavior(
  header: HTMLElement,
  bounds: Bounds,
  onBoundsChange: (bounds: Bounds) => void,
  signal: AbortSignal
): void {
  const state: DragState = {
    isDragging: false,
    startX: 0,
    startY: 0,
    startBoundsX: 0,
    startBoundsY: 0,
  };

  function onMouseMove(e: MouseEvent): void {
    if (!state.isDragging) return;
    bounds.x = Math.max(0, state.startBoundsX + (e.clientX - state.startX));
    bounds.y = Math.max(0, state.startBoundsY + (e.clientY - state.startY));
    onBoundsChange(bounds);
  }

  function onMouseUp(): void {
    state.isDragging = false;
    document.removeEventListener("mousemove", onMouseMove);
    document.removeEventListener("mouseup", onMouseUp);
    document.body.style.userSelect = "";
    localStorage.setItem(STORAGE_KEYS.BOUNDS, JSON.stringify(bounds));
  }

  header.addEventListener(
    "mousedown",
    (e) => {
      if ((e.target as HTMLElement).tagName === "BUTTON") return;
      state.isDragging = true;
      state.startX = e.clientX;
      state.startY = e.clientY;
      state.startBoundsX = bounds.x;
      state.startBoundsY = bounds.y;
      document.addEventListener("mousemove", onMouseMove);
      document.addEventListener("mouseup", onMouseUp);
      document.body.style.userSelect = "none";
    },
    { signal }
  );
}

function setupResizeBehavior(
  panel: HTMLElement,
  bounds: Bounds,
  onBoundsChange: (bounds: Bounds) => void,
  signal: AbortSignal
): void {
  const state: ResizeState = {
    direction: null,
    startX: 0,
    startY: 0,
    startBounds: { ...DEFAULT_BOUNDS },
  };

  function onMouseMove(e: MouseEvent): void {
    if (!state.direction) return;

    const dx = e.clientX - state.startX;
    const dy = e.clientY - state.startY;
    const start = state.startBounds;

    let { x, y, width, height } = bounds;

    if (state.direction.includes("e")) {
      width = Math.max(MIN_WIDTH, start.width + dx);
    }
    if (state.direction.includes("w")) {
      const newWidth = Math.max(MIN_WIDTH, start.width - dx);
      x = start.x - (newWidth - start.width);
      width = newWidth;
    }
    if (state.direction.includes("s")) {
      height = Math.max(MIN_HEIGHT, start.height + dy);
    }
    if (state.direction.includes("n")) {
      const newHeight = Math.max(MIN_HEIGHT, start.height - dy);
      y = start.y - (newHeight - start.height);
      height = newHeight;
    }

    bounds.x = Math.max(0, x);
    bounds.y = Math.max(0, y);
    bounds.width = width;
    bounds.height = height;
    onBoundsChange(bounds);
  }

  function onMouseUp(): void {
    state.direction = null;
    document.removeEventListener("mousemove", onMouseMove);
    document.removeEventListener("mouseup", onMouseUp);
    document.body.style.userSelect = "";
    localStorage.setItem(STORAGE_KEYS.BOUNDS, JSON.stringify(bounds));
  }

  for (const dir of RESIZE_DIRECTIONS) {
    const handle = createStyledElement("div", getResizeHandleStyle(dir));
    handle.addEventListener(
      "mousedown",
      (e) => {
        e.stopPropagation();
        state.direction = dir;
        state.startX = e.clientX;
        state.startY = e.clientY;
        state.startBounds = { ...bounds };
        document.addEventListener("mousemove", onMouseMove);
        document.addEventListener("mouseup", onMouseUp);
        document.body.style.userSelect = "none";
      },
      { signal }
    );
    panel.appendChild(handle);
  }
}

// ============================================================================
// Main Export
// ============================================================================

export function createDevToolsPanel(
  rawContent: Content,
  onClose: () => void
): HTMLElement {
  // Abort controller for cleanup
  const controller = new AbortController();
  const { signal } = controller;

  // Get current content
  const stored = localStorage.getItem(STORAGE_KEY);
  const currentContent = stored ? (JSON.parse(stored) as Content) : rawContent;
  const hasPreview = Boolean(stored);

  // Get accessed keys
  const accessedKeys = getAccessedKeys();
  const tabKeys = accessedKeys.size > 0 ? Array.from(accessedKeys) : Object.keys(rawContent);

  // Per-tab content storage
  const tabContent = new Map<string, string>();
  for (const key of tabKeys) {
    tabContent.set(key, JSON.stringify(currentContent[key], null, 2));
  }

  // State
  const bounds = getStoredBounds();
  let activeTab = localStorage.getItem(STORAGE_KEYS.TAB) ?? tabKeys[0] ?? "";
  if (!tabKeys.includes(activeTab)) {
    activeTab = tabKeys[0] ?? "";
  }

  // Create panel
  const panel = createStyledElement("div", styles.panel, { id: PANEL_ID });
  updatePanelBounds();

  function updatePanelBounds(): void {
    panel.style.left = `${bounds.x}px`;
    panel.style.top = `${bounds.y}px`;
    panel.style.width = `${bounds.width}px`;
    panel.style.height = `${bounds.height}px`;
  }

  // Scrollbar hiding style
  const styleEl = document.createElement("style");
  styleEl.textContent = `
    #${PANEL_ID} .ce-tabs::-webkit-scrollbar { display: none; }
    #${PANEL_ID} .ce-tabs { scrollbar-width: none; }
  `;
  panel.appendChild(styleEl);

  // Message display
  let messageEl: HTMLElement | null = null;
  let buttonBar: HTMLElement;

  function showMessage(text: string, isError: boolean): void {
    messageEl?.remove();
    messageEl = createStyledElement(
      "div",
      styles.message + (isError ? `background:${COLORS.ERROR};color:white;` : `background:${COLORS.SUCCESS};color:white;`)
    );
    messageEl.textContent = text;
    panel.insertBefore(messageEl, buttonBar);
    setTimeout(() => {
      messageEl?.remove();
      messageEl = null;
    }, TIMING.MESSAGE_DURATION);
  }

  // Cleanup function
  function cleanup(): void {
    controller.abort();
    panel.remove();
    onClose();
  }

  // Create editor first (needed by other components)
  const editor = createEditor(
    tabContent.get(activeTab) ?? "",
    panel,
    (scrollTop) => localStorage.setItem(STORAGE_KEYS.SCROLL, String(scrollTop))
  );

  // Export handler
  async function handleExport(): Promise<void> {
    try {
      tabContent.set(activeTab, editor.getValue());
      const parsed: Content = {};
      for (const [key, value] of tabContent.entries()) {
        parsed[key] = JSON.parse(value) as ContentValue;
      }
      const fullContent = { ...rawContent, ...parsed };
      await navigator.clipboard.writeText(JSON.stringify(fullContent, null, 2));
      showMessage("JSON exported to clipboard!", false);
    } catch {
      showMessage("Failed to copy - invalid JSON", true);
    }
  }

  // Preview handler
  function handlePreview(): void {
    tabContent.set(activeTab, editor.getValue());

    // Validate all tabs
    for (const [key, value] of tabContent.entries()) {
      try {
        JSON.parse(value);
      } catch {
        showMessage(`Invalid JSON in "${key}" tab`, true);
        activeTab = key;
        localStorage.setItem(STORAGE_KEYS.TAB, activeTab);
        editor.setValue(tabContent.get(activeTab) ?? "");
        tabs.updateStyles(activeTab);
        return;
      }
    }

    // Merge and save
    const parsed: Content = {};
    for (const [key, value] of tabContent.entries()) {
      parsed[key] = JSON.parse(value) as ContentValue;
    }
    const fullContent = { ...rawContent, ...parsed };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(fullContent));
    localStorage.setItem(STORAGE_KEYS.SCROLL, String(editor.container.scrollTop));
    location.reload();
  }

  // Reset handler
  function handleReset(): void {
    localStorage.removeItem(STORAGE_KEY);
    localStorage.setItem(STORAGE_KEYS.SCROLL, String(editor.container.scrollTop));
    location.reload();
  }

  // Tab change handler
  function handleTabChange(key: string): void {
    tabContent.set(activeTab, editor.getValue());
    activeTab = key;
    localStorage.setItem(STORAGE_KEYS.TAB, activeTab);
    editor.setValue(tabContent.get(activeTab) ?? "");
    tabs.updateStyles(activeTab);
  }

  // Build components
  const header = createHeader(hasPreview, handleExport, cleanup, signal);
  const tabs = createTabs(tabKeys, activeTab, handleTabChange, signal);
  buttonBar = createButtonBar(hasPreview, handlePreview, handleReset, signal);

  // Setup behaviors
  setupResizeBehavior(panel, bounds, updatePanelBounds, signal);
  setupDragBehavior(header, bounds, updatePanelBounds, signal);

  // Escape key handler
  document.addEventListener(
    "keydown",
    (e) => {
      if (e.key === "Escape") cleanup();
    },
    { signal }
  );

  // Assemble panel
  panel.append(header, tabs.container, editor.container, buttonBar);

  // Restore scroll position
  const savedScroll = localStorage.getItem(STORAGE_KEYS.SCROLL);
  if (savedScroll) {
    requestAnimationFrame(() => {
      editor.container.scrollTop = parseInt(savedScroll, 10);
    });
  }

  return panel;
}
