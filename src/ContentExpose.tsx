import { useEffect, useRef, useState, CSSProperties, useCallback } from "react";
import {
  getRawContent,
  getAccessedKeys,
  getActiveContentForComponent,
} from "./store";
import { highlightJson } from "./highlightJson";

const DEFAULT_BOUNDS = { x: 20, y: 20, width: 400, height: 450 };

function getStoredBounds() {
  if (typeof window === "undefined") return DEFAULT_BOUNDS;
  const stored = localStorage.getItem("content-expose-bounds");
  if (stored) {
    try {
      return { ...DEFAULT_BOUNDS, ...JSON.parse(stored) };
    } catch {
      return DEFAULT_BOUNDS;
    }
  }
  return DEFAULT_BOUNDS;
}

// Inline styles
const styles: Record<string, CSSProperties> = {
  container: {
    position: "fixed",
    backgroundColor: "#1e1e1e",
    borderRadius: "8px",
    boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.25)",
    border: "1px solid #333",
    display: "flex",
    flexDirection: "column",
    zIndex: 9999,
    overflow: "hidden",
  },
  titleBar: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    padding: "4px 8px",
    borderBottom: "1px solid #333",
    backgroundColor: "#323233",
    cursor: "move",
    userSelect: "none",
  },
  titleText: {
    fontSize: "10px",
    fontFamily: "ui-monospace, monospace",
    color: "#888",
  },
  previewIndicator: {
    color: "#eab308",
  },
  titleButtons: {
    display: "flex",
    alignItems: "center",
    gap: "4px",
  },
  exportButton: {
    display: "flex",
    alignItems: "center",
    gap: "4px",
    padding: "2px 6px",
    borderRadius: "4px",
    backgroundColor: "transparent",
    color: "#888",
    fontSize: "10px",
    fontFamily: "ui-monospace, monospace",
    border: "none",
    cursor: "pointer",
  },
  closeButton: {
    width: "20px",
    height: "20px",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    borderRadius: "4px",
    backgroundColor: "transparent",
    color: "#666",
    border: "none",
    cursor: "pointer",
  },
  tabsContainer: {
    display: "flex",
    backgroundColor: "#252526",
    borderBottom: "1px solid #333",
    overflowX: "auto",
  },
  tab: {
    padding: "4px 12px",
    fontSize: "10px",
    fontFamily: "ui-monospace, monospace",
    borderRight: "1px solid #333",
    whiteSpace: "nowrap",
    backgroundColor: "transparent",
    border: "none",
    cursor: "pointer",
  },
  tabActive: {
    backgroundColor: "#1e1e1e",
    color: "#fff",
  },
  tabInactive: {
    color: "#888",
  },
  editorContainer: {
    flex: 1,
    overflow: "auto",
    position: "relative",
  },
  textarea: {
    width: "100%",
    height: "100%",
    minHeight: "200px",
    padding: "8px",
    margin: 0,
    border: "none",
    outline: "none",
    resize: "none",
    fontFamily: "ui-monospace, monospace",
    fontSize: "11px",
    backgroundColor: "#1e1e1e",
    color: "#d4d4d4",
    lineHeight: 1.5,
  },
  successMessage: {
    padding: "4px 8px",
    backgroundColor: "#2ea043",
    color: "white",
    fontSize: "10px",
    fontFamily: "ui-monospace, monospace",
    textAlign: "center",
  },
  errorMessage: {
    padding: "4px 8px",
    backgroundColor: "#da3633",
    color: "white",
    fontSize: "10px",
    fontFamily: "ui-monospace, monospace",
    textAlign: "center",
  },
  actionsContainer: {
    display: "flex",
    gap: "4px",
    padding: "4px",
    borderTop: "1px solid #333",
    backgroundColor: "#252526",
  },
  previewButton: {
    flex: 1,
    padding: "4px 8px",
    fontSize: "10px",
    fontFamily: "ui-monospace, monospace",
    backgroundColor: "#0e639c",
    color: "white",
    borderRadius: "4px",
    border: "none",
    cursor: "pointer",
  },
  resetButton: {
    flex: 1,
    padding: "4px 8px",
    fontSize: "10px",
    fontFamily: "ui-monospace, monospace",
    backgroundColor: "#333",
    color: "#ccc",
    borderRadius: "4px",
    border: "none",
    cursor: "pointer",
  },
  resizeHandle: {
    position: "absolute",
    bottom: 0,
    right: 0,
    width: "16px",
    height: "16px",
    cursor: "se-resize",
    background: "linear-gradient(135deg, transparent 50%, #666 50%)",
  },
};

export function ContentExpose() {
  const [isOpen, setIsOpen] = useState(() => {
    if (typeof window !== "undefined") {
      return localStorage.getItem("content-expose-open") === "true";
    }
    return false;
  });
  const [bounds, setBounds] = useState(getStoredBounds);
  const [tabs, setTabs] = useState<Record<string, string>>({});
  const [activeTab, setActiveTab] = useState<string>(() => {
    if (typeof window !== "undefined") {
      return localStorage.getItem("content-expose-tab") || "";
    }
    return "";
  });
  const [hasPreview, setHasPreview] = useState(false);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [isResizing, setIsResizing] = useState(false);
  const dragStartRef = useRef({ x: 0, y: 0, boundsX: 0, boundsY: 0 });
  const resizeStartRef = useRef({ x: 0, y: 0, width: 0, height: 0 });

  useEffect(() => {
    localStorage.setItem("content-expose-open", isOpen ? "true" : "false");
  }, [isOpen]);

  useEffect(() => {
    localStorage.setItem("content-expose-bounds", JSON.stringify(bounds));
  }, [bounds]);

  useEffect(() => {
    if (activeTab) {
      localStorage.setItem("content-expose-tab", activeTab);
    }
  }, [activeTab]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "e") {
        e.preventDefault();
        setIsOpen((prev) => !prev);
      }
      if (e.key === "Escape" && isOpen) {
        setIsOpen(false);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen]);

  useEffect(() => {
    if (isOpen) {
      const accessedKeys = getAccessedKeys();
      const activeContent = getActiveContentForComponent();
      const accessed = Array.from(accessedKeys);
      const tabsData: Record<string, string> = {};
      accessed.forEach((key) => {
        tabsData[key] = JSON.stringify(activeContent[key], null, 2);
      });
      setTabs(tabsData);
      if (!activeTab || !accessed.includes(activeTab)) {
        setActiveTab(accessed[0] || "");
      }
      setHasPreview(!!localStorage.getItem("content-expose-preview"));
    }
  }, [isOpen, activeTab]);

  // Drag handling
  const handleDragStart = useCallback((e: React.MouseEvent) => {
    setIsDragging(true);
    dragStartRef.current = {
      x: e.clientX,
      y: e.clientY,
      boundsX: bounds.x,
      boundsY: bounds.y,
    };
  }, [bounds.x, bounds.y]);

  useEffect(() => {
    if (!isDragging) return;

    const handleMouseMove = (e: MouseEvent) => {
      const dx = e.clientX - dragStartRef.current.x;
      const dy = e.clientY - dragStartRef.current.y;
      setBounds((b: typeof DEFAULT_BOUNDS) => ({
        ...b,
        x: Math.max(0, dragStartRef.current.boundsX + dx),
        y: Math.max(0, dragStartRef.current.boundsY + dy),
      }));
    };

    const handleMouseUp = () => {
      setIsDragging(false);
    };

    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleMouseUp);
    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
    };
  }, [isDragging]);

  // Resize handling
  const handleResizeStart = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    setIsResizing(true);
    resizeStartRef.current = {
      x: e.clientX,
      y: e.clientY,
      width: bounds.width,
      height: bounds.height,
    };
  }, [bounds.width, bounds.height]);

  useEffect(() => {
    if (!isResizing) return;

    const handleMouseMove = (e: MouseEvent) => {
      const dx = e.clientX - resizeStartRef.current.x;
      const dy = e.clientY - resizeStartRef.current.y;
      setBounds((b: typeof DEFAULT_BOUNDS) => ({
        ...b,
        width: Math.max(250, resizeStartRef.current.width + dx),
        height: Math.max(200, resizeStartRef.current.height + dy),
      }));
    };

    const handleMouseUp = () => {
      setIsResizing(false);
    };

    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleMouseUp);
    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
    };
  }, [isResizing]);

  if (!isOpen) return null;

  const tabKeys = Object.keys(tabs);
  let rawContent: Record<string, unknown>;
  try {
    rawContent = getRawContent();
  } catch {
    return null; // Not initialized yet
  }

  const handleTabChange = (key: string, value: string) => {
    setTabs((prev) => ({ ...prev, [key]: value }));
  };

  const handlePreview = () => {
    for (const [key, value] of Object.entries(tabs)) {
      try {
        JSON.parse(value);
      } catch {
        setError(`Invalid JSON in "${key}" tab`);
        setActiveTab(key);
        setTimeout(() => setError(null), 3000);
        return;
      }
    }

    const parsed: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(tabs)) {
      parsed[key] = JSON.parse(value);
    }
    const fullContent = { ...rawContent, ...parsed };
    localStorage.setItem("content-expose-preview", JSON.stringify(fullContent));
    window.location.reload();
  };

  const handleReset = () => {
    localStorage.removeItem("content-expose-preview");
    window.location.reload();
  };

  const handleCopy = async () => {
    try {
      const parsed: Record<string, unknown> = {};
      for (const [key, value] of Object.entries(tabs)) {
        parsed[key] = JSON.parse(value);
      }
      const fullContent = { ...rawContent, ...parsed };
      await navigator.clipboard.writeText(JSON.stringify(fullContent, null, 2));
      setCopied(true);
      setTimeout(() => setCopied(false), 3000);
    } catch {
      alert("Failed to copy");
    }
  };

  return (
    <div
      style={{
        ...styles.container,
        left: bounds.x,
        top: bounds.y,
        width: bounds.width,
        height: bounds.height,
      }}
    >
      {/* Title bar - draggable */}
      <div style={styles.titleBar} onMouseDown={handleDragStart}>
        <span style={styles.titleText}>
          Content Expose{" "}
          {hasPreview && <span style={styles.previewIndicator}>*</span>}
        </span>
        <div style={styles.titleButtons}>
          <button
            onClick={handleCopy}
            style={styles.exportButton}
            onMouseDown={(e) => e.stopPropagation()}
          >
            <svg
              style={{ width: "12px", height: "12px" }}
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"
              />
            </svg>
            Export
          </button>
          <button
            onClick={() => setIsOpen(false)}
            style={styles.closeButton}
            onMouseDown={(e) => e.stopPropagation()}
          >
            ✕
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div style={styles.tabsContainer}>
        {tabKeys.map((key) => (
          <button
            key={key}
            onClick={() => setActiveTab(key)}
            style={{
              ...styles.tab,
              ...(activeTab === key ? styles.tabActive : styles.tabInactive),
            }}
          >
            {key}
          </button>
        ))}
      </div>

      {/* Editor - simple textarea */}
      <div style={styles.editorContainer}>
        <textarea
          value={tabs[activeTab] || ""}
          onChange={(e) => handleTabChange(activeTab, e.target.value)}
          style={styles.textarea}
          spellCheck={false}
        />
      </div>

      {/* Success message */}
      {copied && (
        <div style={styles.successMessage}>
          JSON exported to clipboard. Now make a PR in your repo to publish it!
        </div>
      )}

      {/* Error message */}
      {error && <div style={styles.errorMessage}>{error}</div>}

      {/* Actions */}
      <div style={styles.actionsContainer}>
        <button onClick={handlePreview} style={styles.previewButton}>
          Preview
        </button>
        {hasPreview && (
          <button onClick={handleReset} style={styles.resetButton}>
            Reset
          </button>
        )}
      </div>

      {/* Resize handle */}
      <div style={styles.resizeHandle} onMouseDown={handleResizeStart} />
    </div>
  );
}
