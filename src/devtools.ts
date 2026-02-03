// Vanilla JS DevTools Panel - no dependencies

import { STORAGE_KEY } from "./index";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyContent = Record<string, any>;

const PANEL_ID = "content-expose-devtools";

// Inline styles
const styles = {
  panel: `
    position: fixed;
    top: 20px;
    right: 20px;
    width: 500px;
    height: 600px;
    background: #1a1a2e;
    border: 1px solid #3a3a5e;
    border-radius: 8px;
    box-shadow: 0 8px 32px rgba(0, 0, 0, 0.4);
    z-index: 999999;
    display: flex;
    flex-direction: column;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    color: #e0e0e0;
  `,
  header: `
    padding: 12px 16px;
    background: #16213e;
    border-bottom: 1px solid #3a3a5e;
    border-radius: 8px 8px 0 0;
    cursor: move;
    user-select: none;
    display: flex;
    justify-content: space-between;
    align-items: center;
  `,
  title: `
    font-size: 14px;
    font-weight: 600;
    color: #fff;
    margin: 0;
  `,
  closeBtn: `
    background: none;
    border: none;
    color: #888;
    font-size: 20px;
    cursor: pointer;
    padding: 0 4px;
    line-height: 1;
  `,
  textarea: `
    flex: 1;
    margin: 12px;
    padding: 12px;
    background: #0f0f1a;
    border: 1px solid #3a3a5e;
    border-radius: 4px;
    color: #e0e0e0;
    font-family: 'Monaco', 'Menlo', 'Ubuntu Mono', monospace;
    font-size: 12px;
    line-height: 1.5;
    resize: none;
    outline: none;
  `,
  buttonBar: `
    padding: 12px 16px;
    background: #16213e;
    border-top: 1px solid #3a3a5e;
    border-radius: 0 0 8px 8px;
    display: flex;
    gap: 8px;
  `,
  button: `
    padding: 8px 16px;
    border: none;
    border-radius: 4px;
    font-size: 13px;
    font-weight: 500;
    cursor: pointer;
    transition: background 0.2s;
  `,
  saveBtn: `
    background: #4ade80;
    color: #000;
  `,
  resetBtn: `
    background: #ef4444;
    color: #fff;
  `,
  exportBtn: `
    background: #3b82f6;
    color: #fff;
    margin-left: auto;
  `,
  status: `
    padding: 4px 8px;
    font-size: 11px;
    color: #888;
    margin-left: auto;
  `,
};

export function createDevToolsPanel(
  rawContent: AnyContent,
  onClose: () => void
): HTMLElement {
  // Get current content (from localStorage or raw)
  const stored = localStorage.getItem(STORAGE_KEY);
  const currentContent = stored ? JSON.parse(stored) : rawContent;
  const hasPreview = !!stored;

  // Create panel
  const panel = document.createElement("div");
  panel.id = PANEL_ID;
  panel.style.cssText = styles.panel;

  // Header with drag handle
  const header = document.createElement("div");
  header.style.cssText = styles.header;

  const title = document.createElement("h3");
  title.style.cssText = styles.title;
  title.textContent = "Content Exposé";

  const status = document.createElement("span");
  status.style.cssText = styles.status;
  status.textContent = hasPreview ? "Preview Mode" : "Using raw content";

  const closeBtn = document.createElement("button");
  closeBtn.style.cssText = styles.closeBtn;
  closeBtn.textContent = "×";
  closeBtn.onclick = () => {
    panel.remove();
    onClose();
  };

  header.appendChild(title);
  header.appendChild(status);
  header.appendChild(closeBtn);

  // Textarea
  const textarea = document.createElement("textarea");
  textarea.style.cssText = styles.textarea;
  textarea.value = JSON.stringify(currentContent, null, 2);
  textarea.spellcheck = false;

  // Button bar
  const buttonBar = document.createElement("div");
  buttonBar.style.cssText = styles.buttonBar;

  const saveBtn = document.createElement("button");
  saveBtn.style.cssText = styles.button + styles.saveBtn;
  saveBtn.textContent = "Save & Reload";
  saveBtn.onclick = () => {
    try {
      const parsed = JSON.parse(textarea.value);
      localStorage.setItem(STORAGE_KEY, JSON.stringify(parsed));
      location.reload();
    } catch (e) {
      alert("Invalid JSON: " + (e as Error).message);
    }
  };

  const resetBtn = document.createElement("button");
  resetBtn.style.cssText = styles.button + styles.resetBtn;
  resetBtn.textContent = "Reset";
  resetBtn.onclick = () => {
    localStorage.removeItem(STORAGE_KEY);
    location.reload();
  };

  const exportBtn = document.createElement("button");
  exportBtn.style.cssText = styles.button + styles.exportBtn;
  exportBtn.textContent = "Copy JSON";
  exportBtn.onclick = async () => {
    try {
      const parsed = JSON.parse(textarea.value);
      await navigator.clipboard.writeText(JSON.stringify(parsed, null, 2));
      const originalText = exportBtn.textContent;
      exportBtn.textContent = "Copied!";
      setTimeout(() => {
        exportBtn.textContent = originalText;
      }, 1500);
    } catch (e) {
      alert("Invalid JSON: " + (e as Error).message);
    }
  };

  buttonBar.appendChild(saveBtn);
  buttonBar.appendChild(resetBtn);
  buttonBar.appendChild(exportBtn);

  // Assemble panel
  panel.appendChild(header);
  panel.appendChild(textarea);
  panel.appendChild(buttonBar);

  // Make draggable
  makeDraggable(panel, header);

  return panel;
}

function makeDraggable(panel: HTMLElement, handle: HTMLElement): void {
  let isDragging = false;
  let startX = 0;
  let startY = 0;
  let startLeft = 0;
  let startTop = 0;

  handle.addEventListener("mousedown", (e) => {
    if ((e.target as HTMLElement).tagName === "BUTTON") return;

    isDragging = true;
    startX = e.clientX;
    startY = e.clientY;

    const rect = panel.getBoundingClientRect();
    startLeft = rect.left;
    startTop = rect.top;

    // Switch from right-positioned to left-positioned
    panel.style.right = "auto";
    panel.style.left = startLeft + "px";
    panel.style.top = startTop + "px";

    document.addEventListener("mousemove", onMouseMove);
    document.addEventListener("mouseup", onMouseUp);
  });

  function onMouseMove(e: MouseEvent): void {
    if (!isDragging) return;

    const dx = e.clientX - startX;
    const dy = e.clientY - startY;

    panel.style.left = startLeft + dx + "px";
    panel.style.top = startTop + dy + "px";
  }

  function onMouseUp(): void {
    isDragging = false;
    document.removeEventListener("mousemove", onMouseMove);
    document.removeEventListener("mouseup", onMouseUp);
  }
}
