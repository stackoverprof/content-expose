// Vanilla JS DevTools Panel - no dependencies

import { STORAGE_KEY, getAccessedKeys } from "./index";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyContent = Record<string, any>;

type ResizeDirection = "n" | "s" | "e" | "w" | "ne" | "nw" | "se" | "sw";

const PANEL_ID = "content-expose-devtools";
const BOUNDS_KEY = "content-expose-bounds";
const TAB_KEY = "content-expose-tab";
const SCROLL_KEY = "content-expose-scroll";

const DEFAULT_BOUNDS = { x: 20, y: 20, width: 400, height: 450 };
const MIN_WIDTH = 300;
const MIN_HEIGHT = 250;

function getStoredBounds(): typeof DEFAULT_BOUNDS {
  const stored = localStorage.getItem(BOUNDS_KEY);
  if (stored) {
    try {
      return { ...DEFAULT_BOUNDS, ...JSON.parse(stored) };
    } catch {
      return DEFAULT_BOUNDS;
    }
  }
  return DEFAULT_BOUNDS;
}

// JSON syntax highlighter
function highlightJson(code: string): string {
  let result = "";
  let i = 0;

  while (i < code.length) {
    const char = code[i];

    // Whitespace
    if (/\s/.test(char)) {
      result += char;
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
      if (code[j] === ":") {
        result += `<span style="color:#79c0ff">${escapeHtml(str)}</span>`;
      } else {
        result += `<span style="color:#a5d6ff">${escapeHtml(str)}</span>`;
      }
      continue;
    }

    // Number
    if (/[-\d]/.test(char)) {
      let num = "";
      while (i < code.length && /[\d.eE+-]/.test(code[i])) {
        num += code[i];
        i++;
      }
      result += `<span style="color:#a5d6ff">${num}</span>`;
      continue;
    }

    // Boolean / null
    if (code.slice(i, i + 4) === "true") {
      result += `<span style="color:#ff7b72">true</span>`;
      i += 4;
      continue;
    }
    if (code.slice(i, i + 5) === "false") {
      result += `<span style="color:#ff7b72">false</span>`;
      i += 5;
      continue;
    }
    if (code.slice(i, i + 4) === "null") {
      result += `<span style="color:#ff7b72">null</span>`;
      i += 4;
      continue;
    }

    // Punctuation
    if (/[{}\[\]:,]/.test(char)) {
      result += `<span style="color:#6e7681">${char}</span>`;
      i++;
      continue;
    }

    // Unrecognized characters
    result += `<span style="color:#6e7681">${escapeHtml(char)}</span>`;
    i++;
  }

  return result;
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

// Inline styles
const styles = {
  panel: `
    position: fixed;
    background: #1e1e1e;
    border-radius: 8px;
    box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.5), 0 0 0 1px rgba(255, 255, 255, 0.1);
    border: 1px solid #333;
    z-index: 999999;
    display: flex;
    flex-direction: column;
    font-family: ui-monospace, monospace;
    color: #d4d4d4;
    overflow: hidden;
  `,
  header: `
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 4px 8px;
    border-bottom: 1px solid #333;
    background: #323233;
    cursor: move;
    user-select: none;
    flex-shrink: 0;
  `,
  title: `
    font-size: 10px;
    color: #888;
    margin: 0;
  `,
  previewIndicator: `
    color: #eab308;
  `,
  headerButtons: `
    display: flex;
    align-items: center;
    gap: 4px;
  `,
  exportBtn: `
    display: flex;
    align-items: center;
    gap: 4px;
    padding: 2px 6px;
    border-radius: 4px;
    background: transparent;
    color: #888;
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
    color: #666;
    border: none;
    cursor: pointer;
    font-size: 14px;
  `,
  tabsContainer: `
    display: flex;
    background: #252526;
    border-bottom: 1px solid #333;
    overflow-x: auto;
    overflow-y: hidden;
    flex-shrink: 0;
  `,
  tab: `
    padding: 4px 12px;
    font-size: 10px;
    font-family: ui-monospace, monospace;
    border: none;
    border-right: 1px solid #333;
    white-space: nowrap;
    cursor: pointer;
    flex-shrink: 0;
  `,
  tabActive: `
    background: #1e1e1e;
    color: #fff;
  `,
  tabInactive: `
    background: transparent;
    color: #888;
  `,
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
    border-top: 1px solid #333;
    background: #252526;
    flex-shrink: 0;
  `,
  previewBtn: `
    flex: 1;
    padding: 4px 8px;
    font-size: 10px;
    font-family: ui-monospace, monospace;
    background: #0e639c;
    color: white;
    border-radius: 4px;
    border: none;
    cursor: pointer;
  `,
  resetBtn: `
    flex: 1;
    padding: 4px 8px;
    font-size: 10px;
    font-family: ui-monospace, monospace;
    background: #333;
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
  successMessage: `
    background: #2ea043;
    color: white;
  `,
  errorMessage: `
    background: #da3633;
    color: white;
  `,
};

const resizeHandleStyles: Record<ResizeDirection, string> = {
  n: "position: absolute; top: 0; left: 12px; right: 12px; height: 6px; cursor: ns-resize; z-index: 10;",
  s: "position: absolute; bottom: 0; left: 12px; right: 12px; height: 6px; cursor: ns-resize; z-index: 10;",
  e: "position: absolute; right: 0; top: 12px; bottom: 12px; width: 6px; cursor: ew-resize; z-index: 10;",
  w: "position: absolute; left: 0; top: 12px; bottom: 12px; width: 6px; cursor: ew-resize; z-index: 10;",
  ne: "position: absolute; top: 0; right: 0; width: 14px; height: 14px; cursor: nesw-resize; z-index: 11;",
  nw: "position: absolute; top: 0; left: 0; width: 14px; height: 14px; cursor: nwse-resize; z-index: 11;",
  se: "position: absolute; bottom: 0; right: 0; width: 14px; height: 14px; cursor: nwse-resize; z-index: 11;",
  sw: "position: absolute; bottom: 0; left: 0; width: 14px; height: 14px; cursor: nesw-resize; z-index: 11;",
};

export function createDevToolsPanel(
  rawContent: AnyContent,
  onClose: () => void
): HTMLElement {
  // Get current content (from localStorage or raw)
  const stored = localStorage.getItem(STORAGE_KEY);
  const currentContent = stored ? JSON.parse(stored) : rawContent;
  const hasPreview = !!stored;

  // Get accessed keys - fall back to all keys if none tracked yet
  const accessedKeys = getAccessedKeys();
  const tabKeys = accessedKeys.size > 0 ? Array.from(accessedKeys) : Object.keys(rawContent);

  // Per-tab content storage
  const tabContent = new Map<string, string>();
  tabKeys.forEach((key) => {
    tabContent.set(key, JSON.stringify(currentContent[key], null, 2));
  });

  // State
  let bounds = getStoredBounds();
  let activeTab = localStorage.getItem(TAB_KEY) || tabKeys[0] || "";
  if (!tabKeys.includes(activeTab)) {
    activeTab = tabKeys[0] || "";
  }

  // Create panel
  const panel = document.createElement("div");
  panel.id = PANEL_ID;
  panel.style.cssText = styles.panel;
  updatePanelBounds();

  function updatePanelBounds(): void {
    panel.style.left = bounds.x + "px";
    panel.style.top = bounds.y + "px";
    panel.style.width = bounds.width + "px";
    panel.style.height = bounds.height + "px";
  }

  function saveBounds(): void {
    localStorage.setItem(BOUNDS_KEY, JSON.stringify(bounds));
  }

  // Hide scrollbar style
  const styleEl = document.createElement("style");
  styleEl.textContent = `
    #${PANEL_ID} .ce-tabs::-webkit-scrollbar { display: none; }
    #${PANEL_ID} .ce-tabs { scrollbar-width: none; }
  `;
  panel.appendChild(styleEl);

  // Resize handles
  (["n", "s", "e", "w", "ne", "nw", "se", "sw"] as ResizeDirection[]).forEach((dir) => {
    const handle = document.createElement("div");
    handle.style.cssText = resizeHandleStyles[dir];
    handle.addEventListener("mousedown", (e) => {
      e.stopPropagation();
      startResize(dir, e);
    });
    panel.appendChild(handle);
  });

  // Resize logic
  let resizeDir: ResizeDirection | null = null;
  let resizeStart = { x: 0, y: 0, bounds: { ...DEFAULT_BOUNDS } };

  function startResize(dir: ResizeDirection, e: MouseEvent): void {
    resizeDir = dir;
    resizeStart = { x: e.clientX, y: e.clientY, bounds: { ...bounds } };
    document.addEventListener("mousemove", onResizeMove);
    document.addEventListener("mouseup", onResizeEnd);
    document.body.style.userSelect = "none";
  }

  function onResizeMove(e: MouseEvent): void {
    if (!resizeDir) return;
    const dx = e.clientX - resizeStart.x;
    const dy = e.clientY - resizeStart.y;
    const start = resizeStart.bounds;

    let { x, y, width, height } = bounds;

    if (resizeDir.includes("e")) {
      width = Math.max(MIN_WIDTH, start.width + dx);
    }
    if (resizeDir.includes("w")) {
      const newWidth = Math.max(MIN_WIDTH, start.width - dx);
      const widthDiff = newWidth - start.width;
      x = start.x - widthDiff;
      width = newWidth;
    }
    if (resizeDir.includes("s")) {
      height = Math.max(MIN_HEIGHT, start.height + dy);
    }
    if (resizeDir.includes("n")) {
      const newHeight = Math.max(MIN_HEIGHT, start.height - dy);
      const heightDiff = newHeight - start.height;
      y = start.y - heightDiff;
      height = newHeight;
    }

    bounds = { x: Math.max(0, x), y: Math.max(0, y), width, height };
    updatePanelBounds();
  }

  function onResizeEnd(): void {
    resizeDir = null;
    document.removeEventListener("mousemove", onResizeMove);
    document.removeEventListener("mouseup", onResizeEnd);
    document.body.style.userSelect = "";
    saveBounds();
  }

  // Header with drag handle
  const header = document.createElement("div");
  header.style.cssText = styles.header;

  const title = document.createElement("span");
  title.style.cssText = styles.title;
  title.innerHTML = `Content Expose${hasPreview ? ` <span style="${styles.previewIndicator}">*</span>` : ""}`;

  const headerButtons = document.createElement("div");
  headerButtons.style.cssText = styles.headerButtons;

  const exportBtn = document.createElement("button");
  exportBtn.style.cssText = styles.exportBtn;
  exportBtn.innerHTML = `<svg style="width:12px;height:12px" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"/></svg> Export`;
  exportBtn.addEventListener("mouseenter", () => {
    exportBtn.style.background = "#444";
    exportBtn.style.color = "#ccc";
  });
  exportBtn.addEventListener("mouseleave", () => {
    exportBtn.style.background = "transparent";
    exportBtn.style.color = "#888";
  });

  const closeBtn = document.createElement("button");
  closeBtn.style.cssText = styles.closeBtn;
  closeBtn.textContent = "✕";
  closeBtn.addEventListener("mouseenter", () => {
    closeBtn.style.background = "#444";
    closeBtn.style.color = "#ccc";
  });
  closeBtn.addEventListener("mouseleave", () => {
    closeBtn.style.background = "transparent";
    closeBtn.style.color = "#666";
  });
  closeBtn.addEventListener("click", () => {
    panel.remove();
    onClose();
  });

  headerButtons.appendChild(exportBtn);
  headerButtons.appendChild(closeBtn);
  header.appendChild(title);
  header.appendChild(headerButtons);
  panel.appendChild(header);

  // Drag logic
  let isDragging = false;
  let dragStart = { x: 0, y: 0, boundsX: 0, boundsY: 0 };

  header.addEventListener("mousedown", (e) => {
    if ((e.target as HTMLElement).tagName === "BUTTON") return;
    isDragging = true;
    dragStart = { x: e.clientX, y: e.clientY, boundsX: bounds.x, boundsY: bounds.y };
    document.addEventListener("mousemove", onDragMove);
    document.addEventListener("mouseup", onDragEnd);
    document.body.style.userSelect = "none";
  });

  function onDragMove(e: MouseEvent): void {
    if (!isDragging) return;
    const dx = e.clientX - dragStart.x;
    const dy = e.clientY - dragStart.y;
    bounds.x = Math.max(0, dragStart.boundsX + dx);
    bounds.y = Math.max(0, dragStart.boundsY + dy);
    updatePanelBounds();
  }

  function onDragEnd(): void {
    isDragging = false;
    document.removeEventListener("mousemove", onDragMove);
    document.removeEventListener("mouseup", onDragEnd);
    document.body.style.userSelect = "";
    saveBounds();
  }

  // Tabs container
  const tabsContainer = document.createElement("div");
  tabsContainer.className = "ce-tabs";
  tabsContainer.style.cssText = styles.tabsContainer;

  const tabButtons: HTMLButtonElement[] = [];

  function updateTabStyles(): void {
    tabButtons.forEach((btn, i) => {
      const key = tabKeys[i];
      if (key === activeTab) {
        btn.style.cssText = styles.tab + styles.tabActive;
      } else {
        btn.style.cssText = styles.tab + styles.tabInactive;
      }
    });
  }

  // Forward declaration for updateHighlight
  let updateHighlight: () => void;

  tabKeys.forEach((key) => {
    const tabBtn = document.createElement("button");
    tabBtn.textContent = key;
    tabBtn.addEventListener("click", () => {
      // Save current tab content
      tabContent.set(activeTab, textarea.value);
      // Switch tab
      activeTab = key;
      localStorage.setItem(TAB_KEY, activeTab);
      textarea.value = tabContent.get(activeTab) || "";
      updateTabStyles();
      updateHighlight();
    });
    tabBtn.addEventListener("mouseenter", () => {
      if (key !== activeTab) {
        tabBtn.style.background = "#2d2d2d";
      }
    });
    tabBtn.addEventListener("mouseleave", () => {
      if (key !== activeTab) {
        tabBtn.style.background = "transparent";
      }
    });
    tabButtons.push(tabBtn);
    tabsContainer.appendChild(tabBtn);
  });

  updateTabStyles();
  panel.appendChild(tabsContainer);

  // Editor container with syntax highlighting
  const editorContainer = document.createElement("div");
  editorContainer.style.cssText = styles.editorContainer;

  const editorWrapper = document.createElement("div");
  editorWrapper.style.cssText = styles.editorWrapper;

  const highlightDiv = document.createElement("div");
  highlightDiv.style.cssText = styles.editorHighlight;

  const textarea = document.createElement("textarea");
  textarea.style.cssText = styles.textarea;
  textarea.value = tabContent.get(activeTab) || "";
  textarea.spellcheck = false;

  // Update highlight when content changes
  updateHighlight = (): void => {
    highlightDiv.innerHTML = highlightJson(textarea.value);
    // Auto-resize textarea to fit content (only when in DOM with valid dimensions)
    if (panel.isConnected) {
      textarea.style.height = "auto";
      textarea.style.height = textarea.scrollHeight + "px";
    }
  };

  textarea.addEventListener("input", updateHighlight);
  textarea.addEventListener("scroll", () => {
    highlightDiv.scrollTop = textarea.scrollTop;
    highlightDiv.scrollLeft = textarea.scrollLeft;
  });

  // Initial highlight (height will be set after mount)
  highlightDiv.innerHTML = highlightJson(textarea.value);

  editorWrapper.appendChild(highlightDiv);
  editorWrapper.appendChild(textarea);
  editorContainer.appendChild(editorWrapper);
  panel.appendChild(editorContainer);

  // Resize textarea once panel is in DOM
  setTimeout(() => {
    if (panel.isConnected) {
      textarea.style.height = "auto";
      textarea.style.height = textarea.scrollHeight + "px";
    }
  }, 0);

  // Restore scroll position after panel is in DOM
  const savedScroll = localStorage.getItem(SCROLL_KEY);
  if (savedScroll) {
    requestAnimationFrame(() => {
      editorContainer.scrollTop = parseInt(savedScroll);
    });
  }

  // Message area (for success/error)
  let messageEl: HTMLElement | null = null;

  function showMessage(text: string, isError: boolean): void {
    if (messageEl) messageEl.remove();
    messageEl = document.createElement("div");
    messageEl.style.cssText = styles.message + (isError ? styles.errorMessage : styles.successMessage);
    messageEl.textContent = text;
    panel.insertBefore(messageEl, buttonBar);
    setTimeout(() => {
      if (messageEl) {
        messageEl.remove();
        messageEl = null;
      }
    }, 3000);
  }

  // Button bar
  const buttonBar = document.createElement("div");
  buttonBar.style.cssText = styles.buttonBar;

  const previewBtn = document.createElement("button");
  previewBtn.style.cssText = styles.previewBtn;
  previewBtn.textContent = "Preview";
  previewBtn.addEventListener("mouseenter", () => {
    previewBtn.style.background = "#1177bb";
  });
  previewBtn.addEventListener("mouseleave", () => {
    previewBtn.style.background = "#0e639c";
  });
  previewBtn.addEventListener("click", () => {
    // Save current tab content
    tabContent.set(activeTab, textarea.value);

    // Validate all tabs
    for (const [key, value] of tabContent.entries()) {
      try {
        JSON.parse(value);
      } catch {
        showMessage(`Invalid JSON in "${key}" tab`, true);
        activeTab = key;
        localStorage.setItem(TAB_KEY, activeTab);
        textarea.value = tabContent.get(activeTab) || "";
        updateTabStyles();
        return;
      }
    }

    // Merge and save
    const parsed: AnyContent = {};
    for (const [key, value] of tabContent.entries()) {
      parsed[key] = JSON.parse(value);
    }
    const fullContent = { ...rawContent, ...parsed };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(fullContent));
    localStorage.setItem(SCROLL_KEY, String(editorContainer.scrollTop));
    location.reload();
  });

  const resetBtn = document.createElement("button");
  resetBtn.style.cssText = styles.resetBtn;
  resetBtn.textContent = "Reset";
  resetBtn.addEventListener("mouseenter", () => {
    resetBtn.style.background = "#444";
  });
  resetBtn.addEventListener("mouseleave", () => {
    resetBtn.style.background = "#333";
  });
  resetBtn.addEventListener("click", () => {
    localStorage.removeItem(STORAGE_KEY);
    localStorage.setItem(SCROLL_KEY, String(editorContainer.scrollTop));
    location.reload();
  });

  buttonBar.appendChild(previewBtn);
  if (hasPreview) {
    buttonBar.appendChild(resetBtn);
  }
  panel.appendChild(buttonBar);

  // Export click handler
  exportBtn.addEventListener("click", async () => {
    try {
      // Save current tab content
      tabContent.set(activeTab, textarea.value);

      // Validate and merge
      const parsed: AnyContent = {};
      for (const [key, value] of tabContent.entries()) {
        parsed[key] = JSON.parse(value);
      }
      const fullContent = { ...rawContent, ...parsed };
      await navigator.clipboard.writeText(JSON.stringify(fullContent, null, 2));
      showMessage("JSON exported to clipboard!", false);
    } catch {
      showMessage("Failed to copy - invalid JSON", true);
    }
  });

  // Escape key to close
  const onEscape = (e: KeyboardEvent): void => {
    if (e.key === "Escape") {
      panel.remove();
      onClose();
      document.removeEventListener("keydown", onEscape);
    }
  };
  document.addEventListener("keydown", onEscape);

  return panel;
}
