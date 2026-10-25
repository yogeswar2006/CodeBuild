
import { useEffect, useRef, useState } from "react";
import {
  Files,
  Search,
  Settings,
  PanelLeftClose,
  Code2,
} from "lucide-react";
import useWorkspace from "../hooks/useWorkspace";
import Explorer from "../components/Explorer";
import EditorPane from "../components/EditorPane";

const MIN_WIDTH = 200;
const MAX_WIDTH = 500;
const DEFAULT_WIDTH = 260;
const STORAGE_KEY = "codespace-sidebar-width";

const clamp = (value) =>
  Math.min(MAX_WIDTH, Math.max(MIN_WIDTH, value));

export default function Dashboard() {
  const ws = useWorkspace();

  const [sidebarWidth, setSidebarWidth] = useState(() => {
    const saved = Number(localStorage.getItem(STORAGE_KEY));
    return clamp(saved || DEFAULT_WIDTH);
  });

  const [sidebarVisible, setSidebarVisible] = useState(true);
  const [activeView, setActiveView] = useState("explorer");
  const [dragging, setDragging] = useState(false);

  const dragStartX = useRef(0);
  const dragStartWidth = useRef(DEFAULT_WIDTH);

  useEffect(() => {
    if (!dragging) return;

    const onMove = (event) => {
      setSidebarWidth(
        clamp(
          dragStartWidth.current +
            event.clientX -
            dragStartX.current
        )
      );
    };

    const onUp = () => setDragging(false);

    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";

    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);

    return () => {
      document.body.style.cursor = "";
      document.body.style.userSelect = "";

      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
    };
  }, [dragging]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, String(sidebarWidth));
  }, [sidebarWidth]);

  const startResize = (event) => {
    event.preventDefault();
    dragStartX.current = event.clientX;
    dragStartWidth.current = sidebarWidth;
    setDragging(true);
  };

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-[#1e1e1e] font-sans text-[#cccccc]">

      {/* Activity bar */}
      <aside className="flex w-12 shrink-0 flex-col items-center border-r border-[#333333] bg-[#181818]">
        <button
          type="button"
          title="Explorer"
          onClick={() => {
            setSidebarVisible(true);
            setActiveView("explorer");
          }}
          className={`flex h-12 w-full items-center justify-center border-l-2 ${
            activeView === "explorer"
              ? "border-[#007acc] text-white"
              : "border-transparent text-[#858585] hover:text-white"
          }`}
        >
          <Files size={22} strokeWidth={1.5} />
        </button>

        <button
          type="button"
          title="Search"
          onClick={() => {
            setSidebarVisible(true);
            setActiveView("search");
          }}
          className={`flex h-12 w-full items-center justify-center border-l-2 ${
            activeView === "search"
              ? "border-[#007acc] text-white"
              : "border-transparent text-[#858585] hover:text-white"
          }`}
        >
          <Search size={21} strokeWidth={1.5} />
        </button>

        <div className="flex-1" />

        <button
          type="button"
          title="Settings"
          className="flex h-12 w-full items-center justify-center text-[#858585] hover:text-white"
        >
          <Settings size={21} strokeWidth={1.5} />
        </button>
      </aside>

      {/* Explorer sidebar */}
      {sidebarVisible && (
        <>
          <aside
            style={{ width: sidebarWidth }}
            className="flex shrink-0 flex-col rounded-2xl overflow-hidden border-r border-[#2b2b2b] bg-[#181818]"
          >
            <div className="flex h-[35px] shrink-0 items-center justify-between px-3">
              <span className="text-[12px] font-medium uppercase tracking-wide text-[#bbbbbb]">
                {activeView === "explorer" ? "Explorer" : "Search"}
              </span>

              <button
                type="button"
                title="Hide sidebar"
                onClick={() => setSidebarVisible(false)}
                className="rounded p-1 text-[#858585] hover:bg-[#3c3c3c] hover:text-white"
              >
                <PanelLeftClose size={15} />
              </button>
            </div>

            {activeView === "explorer" ? (
              <Explorer ws={ws} />
            ) : (
              <div className="p-3">
                <input
                  type="search"
                  placeholder="Search"
                  className="w-full border border-[#3c3c3c] bg-[#181818] px-2 py-1.5 text-xs text-white outline-none focus:border-[#007acc]"
                />
                <p className="mt-3 text-xs text-[#858585]">
                  Search functionality can be added here.
                </p>
              </div>
            )}
          </aside>

          {/* Resizable divider */}
          <div
            role="separator"
            aria-label="Resize sidebar"
            aria-orientation="vertical"
            aria-valuenow={sidebarWidth}
            aria-valuemin={MIN_WIDTH}
            aria-valuemax={MAX_WIDTH}
            tabIndex={0}
            onPointerDown={startResize}
            onKeyDown={(event) => {
              if (event.key === "ArrowLeft") {
                setSidebarWidth((width) => clamp(width - 10));
              }

              if (event.key === "ArrowRight") {
                setSidebarWidth((width) => clamp(width + 10));
              }
            }}
            onDoubleClick={() => setSidebarWidth(DEFAULT_WIDTH)}
            className={`relative z-10 w-1 shrink-0 cursor-col-resize ${
              dragging
                ? "bg-[#007acc]"
                : "bg-transparent hover:bg-[#007acc]"
            }`}
          />
        </>
      )}

      {/* Main workspace */}
      <main className="flex min-h-0 min-w-0 flex-1 flex-col bg-[#1e1e1e]">
        {/* Workspace header */}
        <header className="flex h-[35px] shrink-0 items-center border-b border-[#2b2b2b] bg-[#181818]">
          <button
            type="button"
            title="Toggle sidebar"
            onClick={() => setSidebarVisible((visible) => !visible)}
            className="flex h-full items-center px-3 text-[#858585] hover:text-white"
          >
            <PanelLeftClose size={15} />
          </button>

          <div className="flex items-center gap-2 text-xs text-[#858585]">
            <Code2 size={14} className="text-[#007acc]" />
            <span>{ws.project?.name || "Welcome"}</span>
          </div>
        </header>

        {/* Tabs, Monaco editor, welcome screen, and status bar */}
        <div className="min-h-0 flex-1">
          <EditorPane ws={ws} />
        </div>
      </main>
    </div>
  );
}
