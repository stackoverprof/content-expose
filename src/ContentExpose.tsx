import { useEffect, useRef, useState, CSSProperties } from "react";
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

// Inline styles converted from Tailwind
const styles: Record<string, CSSProperties> = {
  container: {
    width: "100%",
    height: "100%",
    backgroundColor: "#1e1e1e",
    borderRadius: "8px",
    boxShadow:
      "0 25px 50px -12px rgba(0, 0, 0, 0.25), 0 0 0 1px rgba(51, 51, 51, 1)",
    border: "1px solid #333",
    display: "flex",
    flexDirection: "column",
  },
  titleBar: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    padding: "4px 8px",
    borderBottom: "1px solid #333",
    backgroundColor: "#323233",
    borderTopLeftRadius: "8px",
    borderTopRightRadius: "8px",
    cursor: "move",
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
    borderBottomLeftRadius: "8px",
    borderBottomRightRadius: "8px",
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
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type RndComponent = any;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type EditorComponent = any;

function ContentExposeInner({
  Rnd,
  Editor,
}: {
  Rnd: RndComponent;
  Editor: EditorComponent;
}) {
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
  const scrollRef = useRef<HTMLDivElement>(null);

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

      // Restore scroll position after render
      requestAnimationFrame(() => {
        const savedScroll = localStorage.getItem("content-expose-scroll");
        if (savedScroll && scrollRef.current) {
          scrollRef.current.scrollTop = parseInt(savedScroll);
        }
      });
    }
  }, [isOpen, activeTab]);

  if (!isOpen) return null;

  const tabKeys = Object.keys(tabs);
  const rawContent = getRawContent();

  const handleTabChange = (key: string, value: string) => {
    setTabs((prev) => ({ ...prev, [key]: value }));
  };

  const handlePreview = () => {
    // Validate all tabs first
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
    // Save scroll position before reload
    if (scrollRef.current) {
      localStorage.setItem(
        "content-expose-scroll",
        String(scrollRef.current.scrollTop)
      );
    }
    window.location.reload();
  };

  const handleReset = () => {
    localStorage.removeItem("content-expose-preview");
    // Save scroll position before reload
    if (scrollRef.current) {
      localStorage.setItem(
        "content-expose-scroll",
        String(scrollRef.current.scrollTop)
      );
    }
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
    <Rnd
      position={{ x: bounds.x, y: bounds.y }}
      size={{ width: bounds.width, height: bounds.height }}
      onDragStop={(_: unknown, d: { x: number; y: number }) =>
        setBounds((b: typeof DEFAULT_BOUNDS) => ({ ...b, x: d.x, y: d.y }))
      }
      onResizeStop={(
        _: unknown,
        __: unknown,
        ref: HTMLElement,
        ___: unknown,
        pos: { x: number; y: number }
      ) =>
        setBounds({
          x: pos.x,
          y: pos.y,
          width: parseInt(ref.style.width),
          height: parseInt(ref.style.height),
        })
      }
      minWidth={250}
      minHeight={200}
      bounds="window"
      style={{ zIndex: 9999 }}
    >
      <div style={styles.container}>
        {/* Title bar */}
        <div style={styles.titleBar}>
          <span style={styles.titleText}>
            Content Expose{" "}
            {hasPreview && <span style={styles.previewIndicator}>*</span>}
          </span>
          <div style={styles.titleButtons}>
            <button
              onClick={handleCopy}
              style={styles.exportButton}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = "#444";
                e.currentTarget.style.color = "#ccc";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = "transparent";
                e.currentTarget.style.color = "#888";
              }}
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
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = "#444";
                e.currentTarget.style.color = "#ccc";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = "transparent";
                e.currentTarget.style.color = "#666";
              }}
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
              onMouseEnter={(e) => {
                if (activeTab !== key) {
                  e.currentTarget.style.backgroundColor = "#2d2d2d";
                }
              }}
              onMouseLeave={(e) => {
                if (activeTab !== key) {
                  e.currentTarget.style.backgroundColor = "transparent";
                }
              }}
            >
              {key}
            </button>
          ))}
        </div>

        {/* Editor */}
        <div ref={scrollRef} style={styles.editorContainer}>
          <Editor
            value={tabs[activeTab] || ""}
            onValueChange={(value: string) => handleTabChange(activeTab, value)}
            highlight={highlightJson}
            padding={8}
            style={{
              fontFamily: "ui-monospace, monospace",
              fontSize: 11,
              backgroundColor: "#1e1e1e",
              minHeight: "100%",
              caretColor: "white",
            }}
          />
        </div>

        {/* Success message */}
        {copied && (
          <div style={styles.successMessage}>
            JSON exported to clipboard. Now make a PR in your repo to publish
            it!
          </div>
        )}

        {/* Error message */}
        {error && <div style={styles.errorMessage}>{error}</div>}

        {/* Actions */}
        <div style={styles.actionsContainer}>
          <button
            onClick={handlePreview}
            style={styles.previewButton}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = "#1177bb";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = "#0e639c";
            }}
          >
            Preview
          </button>
          {hasPreview && (
            <button
              onClick={handleReset}
              style={styles.resetButton}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = "#444";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = "#333";
              }}
            >
              Reset
            </button>
          )}
        </div>
      </div>
    </Rnd>
  );
}

// Client-only wrapper that dynamically imports dependencies
export function ContentExpose() {
  const [components, setComponents] = useState<{
    Rnd: RndComponent;
    Editor: EditorComponent;
  } | null>(null);

  useEffect(() => {
    // Only load on client
    Promise.all([
      import("react-rnd"),
      import("react-simple-code-editor"),
    ]).then(([rndModule, editorModule]) => {
      // Handle various module export formats
      const RndComp = rndModule.Rnd || (rndModule as { default: { Rnd: RndComponent } }).default?.Rnd || (rndModule as { default: RndComponent }).default;
      const EditorComp = editorModule.default || editorModule;

      // Debug logging
      console.log('[content-expose] rndModule:', rndModule);
      console.log('[content-expose] editorModule:', editorModule);
      console.log('[content-expose] RndComp type:', typeof RndComp);
      console.log('[content-expose] EditorComp type:', typeof EditorComp);

      setComponents({
        Rnd: RndComp,
        Editor: EditorComp,
      });
    });
  }, []);

  if (!components) return null;

  return <ContentExposeInner Rnd={components.Rnd} Editor={components.Editor} />;
}
